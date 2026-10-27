const $ = id => document.getElementById(id);
const colors = ["#8fb2ff","#73e0c1","#ffcf7d","#e9a0ff","#ff9a9e","#7de0f0","#b5e986","#ffb88c","#a9a7ff","#f4e285"];
let processCounter = 0;
let latestResult = null;
let playbackTimer = null, playbackIndex = 0, playbackRunning = false, playbackTime = 0;

function addProcess(values = {}) {
  const body = $("processBody");
  if (body.children.length >= 10) return;
  processCounter++;
  const pid = values.pid || `P${processCounter}`;
  const tr = document.createElement("tr");
  tr.dataset.pid = pid;
  tr.innerHTML = `<td class="process-name">${pid}</td>
    <td><input aria-label="${pid} arrival time" type="number" min="0" step="1" value="${values.arrival ?? 0}" class="arrival"></td>
    <td><input aria-label="${pid} burst time" type="number" min="1" step="1" value="${values.burst ?? 5}" class="burst"></td>
    <td><input aria-label="${pid} priority" type="number" min="1" step="1" value="${values.priority ?? 1}" class="priority"></td>
    <td><button class="remove-btn" title="Remove ${pid}" aria-label="Remove ${pid}">×</button></td>`;
  tr.querySelector(".remove-btn").addEventListener("click", () => {
    if (body.children.length <= 1) { showError("At least one process is required."); return; }
    tr.remove(); renumberProcessNames(); clearResults();
  });
  tr.querySelectorAll("input").forEach(input => input.addEventListener("input", clearResults));
  body.appendChild(tr);
  updateAddButton();
}
function renumberProcessNames() {
  [...$("processBody").children].forEach((tr, i) => {
    const pid = `P${i+1}`; tr.dataset.pid = pid; tr.querySelector(".process-name").textContent = pid;
    tr.querySelectorAll("input").forEach(input => input.setAttribute("aria-label", `${pid} ${input.className}`));
    tr.querySelector(".remove-btn").setAttribute("aria-label", `Remove ${pid}`);
  });
  processCounter = $("processBody").children.length; updateAddButton();
}
function updateAddButton(){ $("addProcessBtn").disabled = $("processBody").children.length >= 10; $("addProcessBtn").style.opacity = $("addProcessBtn").disabled ? ".45" : "1"; }
function clearResults(){ $("results").hidden = true; latestResult = null; $("errorBox").hidden = true; $("status").textContent = "Inputs changed · run again to update"; }
function showError(message){ $("errorBox").textContent = message; $("errorBox").hidden = false; }
function readProcesses(){
  const rows = [...$("processBody").children];
  if (!rows.length) throw new Error("Add at least one process.");
  return rows.map((tr, i) => {
    const read = cls => {
      const input = tr.querySelector("." + cls), n = Number(input.value);
      if (input.value.trim() === "" || !Number.isInteger(n) || n < (cls === "burst" || cls === "priority" ? 1 : 0)) {
        throw new Error(`${tr.dataset.pid}: ${cls === "arrival" ? "arrival time must be 0 or more" : cls === "burst" ? "burst time must be at least 1" : "priority must be at least 1"} (whole numbers only).`);
      }
      return n;
    };
    return { pid: tr.dataset.pid || `P${i+1}`, arrival: read("arrival"), burst: read("burst"), priority: read("priority"), index:i, remaining:0, firstStart:null, completion:null, waiting:0, turnaround:0, response:0 };
  });
}
function cloneProcesses(ps){return ps.map(p=>({...p,remaining:p.burst,firstStart:null,completion:null,waiting:0,turnaround:0,response:0}));}
function sortReady(list, compare){ return list.sort(compare); }
function simulate(ps, algorithm, quantum){
  const p = cloneProcesses(ps), segments=[]; let time=0, done=0, guard=0;
  const pushSegment=(pid,start,end)=>{if(end<=start)return; const last=segments[segments.length-1]; if(last && last.pid===pid && last.end===start) last.end=end; else segments.push({pid,start,end});};
  const byArrival=(a,b)=>a.arrival-b.arrival || a.index-b.index;
  const execute=(proc, duration)=>{ if(proc.firstStart===null)proc.firstStart=time; const start=time; time+=duration; proc.remaining-=duration; pushSegment(proc.pid,start,time); if(proc.remaining===0){proc.completion=time;done++;}};
  const unfinished=()=>p.filter(x=>x.remaining>0);
  if(algorithm==="fcfs" || algorithm==="sjf" || algorithm==="priority-np"){
    while(done<p.length && guard++<100000){
      const ready=unfinished().filter(x=>x.arrival<=time);
      if(!ready.length){const next=Math.min(...unfinished().map(x=>x.arrival));pushSegment("IDLE",time,next);time=next;continue;}
      let chosen;
      if(algorithm==="fcfs") chosen=sortReady(ready,(a,b)=>a.arrival-b.arrival||a.index-b.index)[0];
      else if(algorithm==="sjf") chosen=sortReady(ready,(a,b)=>a.burst-b.burst||a.arrival-b.arrival||a.index-b.index)[0];
      else chosen=sortReady(ready,(a,b)=>a.priority-b.priority||a.arrival-b.arrival||a.index-b.index)[0];
      execute(chosen,chosen.remaining);
    }
  } else if(algorithm==="rr"){
    let queue=[], queued=new Set();
    while(done<p.length && guard++<100000){
      p.filter(x=>x.remaining>0 && x.arrival<=time && !queued.has(x.pid)).sort(byArrival).forEach(x=>{queue.push(x);queued.add(x.pid);});
      if(!queue.length){const next=Math.min(...unfinished().map(x=>x.arrival)); if(next>time){pushSegment("IDLE",time,next);time=next;} continue;}
      const cur=queue.shift();queued.delete(cur.pid);
      const duration=Math.min(quantum,cur.remaining);
      if(cur.firstStart===null)cur.firstStart=time;
      const start=time;time+=duration;cur.remaining-=duration;pushSegment(cur.pid,start,time);
      p.filter(x=>x.remaining>0 && x.arrival>start && x.arrival<=time && !queued.has(x.pid)).sort(byArrival).forEach(x=>{queue.push(x);queued.add(x.pid);});
      if(cur.remaining>0){queue.push(cur);queued.add(cur.pid);}else{cur.completion=time;done++;}
    }
  } else {
    // Preemptive policies advance to the next arrival or completion boundary.
    while(done<p.length && guard++<100000){
      const ready=unfinished().filter(x=>x.arrival<=time);
      if(!ready.length){const next=Math.min(...unfinished().map(x=>x.arrival));pushSegment("IDLE",time,next);time=next;continue;}
      let chosen;
      if(algorithm==="srtf")chosen=sortReady(ready,(a,b)=>a.remaining-b.remaining||a.arrival-b.arrival||a.index-b.index)[0];
      else chosen=sortReady(ready,(a,b)=>a.priority-b.priority||a.arrival-b.arrival||a.index-b.index)[0];
      const nextArrival=Math.min(...p.filter(x=>x.remaining>0 && x.arrival>time).map(x=>x.arrival),Infinity);
      const duration=Math.min(chosen.remaining,nextArrival-time);
      execute(chosen,duration);
    }
  }
  if(guard>=100000) throw new Error("Simulation stopped because too many time steps were required.");
  p.forEach(x=>{x.turnaround=x.completion-x.arrival;x.waiting=x.turnaround-x.burst;x.response=x.firstStart-x.arrival;});
  return {processes:p,segments,totalTime:time};
}
const names={"fcfs":"FCFS — First Come, First Served","sjf":"SJF — Shortest Job First (Non-preemptive)","srtf":"SRTF — Shortest Remaining Time First","rr":"Round Robin","priority-np":"Priority — Non-preemptive","priority-p":"Priority — Preemptive"};
const notes={
 fcfs:"FCFS executes processes in arrival order. It is simple and non-preemptive, but a long process can make short processes wait (the convoy effect).",
 sjf:"Non-preemptive SJF selects the available process with the smallest total CPU burst. Once started, that process runs to completion. It often lowers average waiting time, but long jobs may wait longer.",
 srtf:"SRTF is the preemptive form of SJF. The CPU always runs the ready process with the shortest remaining burst. A newly arrived shorter job can preempt the current process.",
 rr:"Round Robin gives each ready process a time slice (time quantum). If it is unfinished, it goes to the back of the ready queue. A small quantum improves responsiveness but increases context-switch overhead.",
 "priority-np":"Non-preemptive Priority selects the ready process with the highest priority (smallest priority number). Once running, it continues until completion. Low-priority processes can starve.",
 "priority-p":"Preemptive Priority runs the ready process with the highest priority (smallest number). If a higher-priority process arrives, it can preempt the current process. Low-priority processes can starve."
};
function renderResults(result,algorithm){
  const ps=result.processes, avg=key=>ps.reduce((s,p)=>s+p[key],0)/ps.length;
  $("avgWaiting").textContent=avg("waiting").toFixed(2);
  $("avgTurnaround").textContent=avg("turnaround").toFixed(2);
  $("avgResponse").textContent=avg("response").toFixed(2);
  $("totalBurst").textContent=ps.reduce((s,p)=>s+p.burst,0);
  $("cpuUtil").textContent=(result.totalTime ? (100*ps.reduce((s,p)=>s+p.burst,0)/result.totalTime).toFixed(1)+"%" : "0%");
  $("cpuUtil").textContent=(result.totalTime ? (100*ps.reduce((s,p)=>s+p.burst,0)/result.totalTime).toFixed(1)+"%" : "0%");
  $("algorithmBadge").textContent=names[algorithm];
  $("explanationTitle").textContent=names[algorithm];
  $("explanationText").textContent=notes[algorithm];
  $("resultsBody").innerHTML=ps.map(p=>`<tr><td>${p.pid}</td><td>${p.arrival}</td><td>${p.burst}</td><td>${p.priority}</td><td>${p.firstStart}</td><td>${p.completion}</td><td>${p.turnaround}</td><td>${p.waiting}</td><td>${p.response}</td></tr>`).join("");
  const chart=$("ganttChart");chart.innerHTML="";
  const total=Math.max(result.totalTime,1);
  result.segments.forEach(seg=>{
    const div=document.createElement("div");div.className="gantt-segment"+(seg.pid==="IDLE"?" idle":"");
    div.style.flex=`${seg.end-seg.start} 1 0%`;
    if(seg.pid!=="IDLE")div.style.background=colors[(Number(seg.pid.slice(1))-1)%colors.length]||colors[0];
    div.innerHTML=`<span>${seg.pid}</span><small>${seg.start}–${seg.end}</small>`;
    div.title=`${seg.pid}: ${seg.start} to ${seg.end}`;chart.appendChild(div);
  });
  $("ganttTicks").innerHTML=`<span>0</span><span>${result.totalTime} time units</span>`;
  $("results").hidden=false;$("status").textContent=`Completed · ${ps.length} processes · makespan ${result.totalTime}`;
  latestResult={...result,algorithm};
  setupPlayback(result);
}
function stopPlaybackTimer(){if(playbackTimer!==null){clearTimeout(playbackTimer);playbackTimer=null;}playbackRunning=false;}
function setupPlayback(result){
  stopPlaybackTimer(); playbackIndex=0; playbackTime=0;
  const btns=['playBtn','pauseBtn','stepBtn','restartBtn'];btns.forEach(id=>$(id).disabled=false);
  $('pauseBtn').disabled=true;$('playBtn').textContent='▶ Play';
  $('playbackStatus').textContent='Ready · press Play to advance one time unit per interval';
  updatePlaybackView(result,false);
}
function updatePlaybackView(result,active){
  const nodes=[...$('ganttChart').children];
  const segIndex=result.segments.findIndex(seg=>playbackTime>=seg.start && playbackTime<seg.end);
  playbackIndex=segIndex;
  nodes.forEach((node,i)=>{node.classList.toggle('playback-active',active&&i===segIndex);node.classList.toggle('playback-done',active&&i<segIndex);});
  const seg=segIndex>=0?result.segments[segIndex]:null;
  $('simTime').textContent=playbackTime;
  $('currentProcess').textContent=active?(seg?seg.pid:(playbackTime>=result.totalTime?'Complete':'Idle')):'—';
  $('playProgress').style.width=(100*Math.min(playbackTime, result.totalTime)/Math.max(result.totalTime,1))+'%';
  $('playbackStatus').textContent=active?`Playing · time ${playbackTime} of ${result.totalTime}`:'Ready · press Play to advance one time unit per interval';
}
function playbackTick(){
  if(!latestResult)return;
  if(playbackTime>=latestResult.totalTime){stopPlaybackTimer();$('playBtn').disabled=false;$('pauseBtn').disabled=true;$('stepBtn').disabled=false;$('playBtn').textContent='▶ Play again';$('playbackStatus').textContent='Playback complete';updatePlaybackView(latestResult,true);return;}
  updatePlaybackView(latestResult,true);
  const speed=Number($('playSpeed').value)||1000;
  playbackTimer=setTimeout(()=>{playbackTime++;playbackTick();},speed);
}
function playPlayback(){if(!latestResult){showError('Run a simulation first.');return;}if(playbackTime>=latestResult.totalTime)playbackTime=0;stopPlaybackTimer();playbackRunning=true;$('playBtn').disabled=true;$('pauseBtn').disabled=false;$('stepBtn').disabled=true;$('playBtn').textContent='▶ Playing';playbackTick();}
function pausePlayback(){stopPlaybackTimer();$('playBtn').disabled=false;$('pauseBtn').disabled=true;$('stepBtn').disabled=false;$('playBtn').textContent='▶ Resume';if(latestResult)$('playbackStatus').textContent='Paused at time '+playbackTime+' · press Resume to continue';}
function stepPlayback(){if(!latestResult){showError('Run a simulation first.');return;}stopPlaybackTimer();$('playBtn').disabled=false;$('pauseBtn').disabled=true;$('stepBtn').disabled=false;if(playbackTime>=latestResult.totalTime)playbackTime=0;updatePlaybackView(latestResult,true);if(playbackTime<latestResult.totalTime)playbackTime++;updatePlaybackView(latestResult,true);$('playbackStatus').textContent=playbackTime>=latestResult.totalTime?'Playback complete':'Stepped to time '+playbackTime;}
function restartPlayback(){if(!latestResult)return;stopPlaybackTimer();playbackIndex=0;playbackTime=0;$('playBtn').disabled=false;$('pauseBtn').disabled=true;$('stepBtn').disabled=false;$('playBtn').textContent='▶ Play';updatePlaybackView(latestResult,false);}

function run(){
  $("errorBox").hidden=true;
  try{
    const ps=readProcesses(), algorithm=$("algorithm").value, quantum=Number($("quantum").value);
    if(algorithm==="rr" && (!Number.isInteger(quantum)||quantum<1))throw new Error("Time quantum must be a whole number of at least 1.");
    const result=simulate(ps,algorithm,quantum);renderResults(result,algorithm);
  }catch(e){showError(e.message||"Unable to simulate these inputs.");$("status").textContent="Please correct the inputs";}
}
function loadSample(){
  $("processBody").innerHTML="";processCounter=0;
  [{arrival:0,burst:5,priority:2},{arrival:1,burst:3,priority:1},{arrival:2,burst:8,priority:4},{arrival:3,burst:6,priority:3}].forEach(p=>addProcess(p));
  $("algorithm").value="fcfs";$("quantum").value=2;updateQuantumField();clearResults();$("status").textContent="Sample data loaded";
}
function clearAll(){
  $("processBody").innerHTML="";processCounter=0;addProcess({arrival:0,burst:5,priority:1});clearResults();$("status").textContent="Inputs cleared";
}
function updateQuantumField(){$("quantumField").style.opacity=$("algorithm").value==="rr"?"1":".55";$("quantum").disabled=$("algorithm").value!=="rr";}
function exportCSV(){
  if(!latestResult)return;
  const rows=[["Process","Arrival","Burst","Priority","First Start","Completion","Turnaround","Waiting","Response"],...latestResult.processes.map(p=>[p.pid,p.arrival,p.burst,p.priority,p.firstStart,p.completion,p.turnaround,p.waiting,p.response])];
  rows.push([]);rows.push(["Algorithm",names[latestResult.algorithm]]);rows.push(["Average waiting time",mean(latestResult.processes,"waiting").toFixed(2)]);rows.push(["Average turnaround time",mean(latestResult.processes,"turnaround").toFixed(2)]);rows.push(["Average response time",mean(latestResult.processes,"response").toFixed(2)]);
  const csv=rows.map(r=>r.map(v=>`"${String(v??"").replaceAll('"','""')}"`).join(",")).join("\r\n");
  const blob=new Blob([csv],{type:"text/csv;charset=utf-8;"}),url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download="cpu-scheduling-results.csv";a.click();URL.revokeObjectURL(url);
}
function mean(ps,key){return ps.reduce((s,p)=>s+p[key],0)/ps.length;}

function randomProcesses(){
  const body=$('processBody'); body.innerHTML=''; processCounter=0;
  const count=4+Math.floor(Math.random()*4);
  for(let i=0;i<count;i++) addProcess({arrival:Math.floor(Math.random()*6),burst:1+Math.floor(Math.random()*9),priority:1+Math.floor(Math.random()*5)});
  clearResults(); $('status').textContent='Random processes generated';
}
function saveInputs(){
  try{localStorage.setItem('osSchedInputs',JSON.stringify({processes:readProcesses(),algorithm:$('algorithm').value,quantum:$('quantum').value}));$('status').textContent='Inputs saved in this browser';}
  catch(e){showError('Could not save inputs: '+e.message)}
}
function loadInputs(){
  try{const data=JSON.parse(localStorage.getItem('osSchedInputs')||'null');if(!data)throw Error('No saved inputs found in this browser.');$('processBody').innerHTML='';processCounter=0;data.processes.forEach(p=>addProcess(p));$('algorithm').value=data.algorithm||'fcfs';$('quantum').value=data.quantum||2;updateQuantumField();clearResults();$('status').textContent='Saved inputs loaded';}
  catch(e){showError(e.message)}
}
function compareAll(){
  try{const ps=readProcesses(),q=Number($('quantum').value);if(!Number.isInteger(q)||q<1)throw Error('Time quantum must be a whole number of at least 1.');
    const keys=['fcfs','sjf','srtf','rr','priority-np','priority-p'];
    const data=keys.map(k=>{const r=simulate(ps,k,q);return {key:k,...r,avgW:mean(r.processes,'waiting'),avgT:mean(r.processes,'turnaround'),avgR:mean(r.processes,'response'),util:r.totalTime?100*ps.reduce((a,p)=>a+p.burst,0)/r.totalTime:0}});
    const best=Math.min(...data.map(x=>x.avgW));$('comparisonBody').innerHTML=data.map(x=>`<tr><td>${names[x.key]}</td><td class="${x.avgW===best?'best-value':''}">${x.avgW.toFixed(2)}${x.avgW===best?' ★':''}</td><td>${x.avgT.toFixed(2)}</td><td>${x.avgR.toFixed(2)}</td><td>${x.util.toFixed(1)}%</td></tr>`).join('');$('comparisonPanel').hidden=false;$('comparisonPanel').scrollIntoView({behavior:'smooth',block:'start'});
  }catch(e){showError(e.message)}
}
$('randomBtn').addEventListener('click',randomProcesses);
$('saveBtn').addEventListener('click',saveInputs);
$('loadBtn').addEventListener('click',loadInputs);
$('compareBtn').addEventListener('click',compareAll);
$('closeCompare').addEventListener('click',()=>$('comparisonPanel').hidden=true);
if(localStorage.getItem('osSchedTheme')==='light')document.body.classList.add('theme-light');
function toggleTheme(){const light=document.body.classList.toggle('theme-light');try{localStorage.setItem('osSchedTheme',light?'light':'dark')}catch(e){} $('themeBtn').textContent=light?'☾ Dark theme':'☼ Light theme';}
$('themeBtn').addEventListener('click',toggleTheme);
$('themeBtn').textContent=document.body.classList.contains('theme-light')?'☾ Dark theme':'☼ Light theme';


function randomProcesses(){
  const body=$('processBody'); body.innerHTML=''; processCounter=0;
  const count=4+Math.floor(Math.random()*4);
  for(let i=0;i<count;i++) addProcess({arrival:Math.floor(Math.random()*6),burst:1+Math.floor(Math.random()*9),priority:1+Math.floor(Math.random()*5)});
  clearResults(); $('status').textContent='Random processes generated';
}
function saveInputs(){
  try{localStorage.setItem('osSchedInputs',JSON.stringify({processes:readProcesses(),algorithm:$('algorithm').value,quantum:$('quantum').value}));$('status').textContent='Inputs saved in this browser';}
  catch(e){showError('Could not save inputs: '+e.message)}
}
function loadInputs(){
  try{const data=JSON.parse(localStorage.getItem('osSchedInputs')||'null');if(!data)throw Error('No saved inputs found in this browser.');$('processBody').innerHTML='';processCounter=0;data.processes.forEach(p=>addProcess(p));$('algorithm').value=data.algorithm||'fcfs';$('quantum').value=data.quantum||2;updateQuantumField();clearResults();$('status').textContent='Saved inputs loaded';}
  catch(e){showError(e.message)}
}
function compareAll(){
  try{const ps=readProcesses(),q=Number($('quantum').value);if(!Number.isInteger(q)||q<1)throw Error('Time quantum must be a whole number of at least 1.');
    const keys=['fcfs','sjf','srtf','rr','priority-np','priority-p'];
    const data=keys.map(k=>{const r=simulate(ps,k,q);return {key:k,...r,avgW:mean(r.processes,'waiting'),avgT:mean(r.processes,'turnaround'),avgR:mean(r.processes,'response'),util:r.totalTime?100*ps.reduce((a,p)=>a+p.burst,0)/r.totalTime:0}});
    const best=Math.min(...data.map(x=>x.avgW));$('comparisonBody').innerHTML=data.map(x=>`<tr><td>${names[x.key]}</td><td class="${x.avgW===best?'best-value':''}">${x.avgW.toFixed(2)}${x.avgW===best?' ★':''}</td><td>${x.avgT.toFixed(2)}</td><td>${x.avgR.toFixed(2)}</td><td>${x.util.toFixed(1)}%</td></tr>`).join('');$('comparisonPanel').hidden=false;$('comparisonPanel').scrollIntoView({behavior:'smooth',block:'start'});
  }catch(e){showError(e.message)}
}
$('randomBtn').addEventListener('click',randomProcesses);
$('saveBtn').addEventListener('click',saveInputs);
$('loadBtn').addEventListener('click',loadInputs);
$('compareBtn').addEventListener('click',compareAll);
$('closeCompare').addEventListener('click',()=>$('comparisonPanel').hidden=true);
if(localStorage.getItem('osSchedTheme')==='light')document.body.classList.add('theme-light');

$('playBtn').addEventListener('click',playPlayback);
$('pauseBtn').addEventListener('click',pausePlayback);
$('stepBtn').addEventListener('click',stepPlayback);
$('restartBtn').addEventListener('click',restartPlayback);
$('playSpeed').addEventListener('change',()=>{if(playbackRunning){pausePlayback();playPlayback();}});

$("addProcessBtn").addEventListener("click",()=>{if($("processBody").children.length<10){addProcess({arrival:0,burst:5,priority:1});clearResults();}});
$("sampleBtn").addEventListener("click",loadSample);$("clearBtn").addEventListener("click",clearAll);
$("runBtn").addEventListener("click",run);$("algorithm").addEventListener("change",()=>{updateQuantumField();clearResults();});
$("quantum").addEventListener("input",clearResults);$("exportBtn").addEventListener("click",exportCSV);$("printBtn").addEventListener("click",()=>window.print());
addProcess({arrival:0,burst:5,priority:2});addProcess({arrival:1,burst:3,priority:1});addProcess({arrival:2,burst:8,priority:4});addProcess({arrival:3,burst:6,priority:3});updateQuantumField();

