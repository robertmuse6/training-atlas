import React,{useEffect,useMemo,useState} from 'react';
import{createRoot}from'react-dom/client';
import{AreaChart,Area,BarChart,Bar,LineChart,Line,XAxis,YAxis,CartesianGrid,Tooltip,Legend,ResponsiveContainer,ReferenceLine,Cell}from'recharts';
import{Activity,Moon,Sun,Timer,Upload,Info,ChevronLeft,ChevronRight,UtensilsCrossed}from'lucide-react';
import './style.css';

type Entry={date:string;type:string;sleep:number|null;energy:number|null;soreness:number|null;workout:string;minutes:number|null;distance:number|null;incline:number|null;item?:string;level?:number|null;day_level?:number|null};

const byDate=(a:string,b:string)=>a.localeCompare(b);
const parseNum=(x:string)=>x.trim()===''?null:Number.isFinite(Number(x))?Number(x):null;

function parseCSV(s:string){
  const lines:string[][]=[];let row:string[]=[],cell='',quoted=false;
  for(let i=0;i<s.length;i++){const ch=s[i];
    if(ch==='"'){if(quoted&&s[i+1]==='"'){cell+='"';i++}else quoted=!quoted}
    else if(ch===','&&!quoted){row.push(cell);cell=''}
    else if((ch==='\n'||ch==='\r')&&!quoted){if(ch==='\r'&&s[i+1]==='\n')i++;row.push(cell);if(row.some(Boolean))lines.push(row);row=[];cell=''}
    else cell+=ch}
  row.push(cell);if(row.some(Boolean))lines.push(row);
  const header=lines.shift()?.map(x=>x.trim().replace(/^﻿/,''))||[];
  const required=['date','record_type','sleep_quality_1_10','morning_energy_1_10','workout_type','duration_min'];
  if(required.some(k=>!header.includes(k)))throw Error('This is not the ledger Entries CSV. Export its Entries tab and try again.');
  const col=(r:string[],name:string)=>r[header.indexOf(name)]??'';
  return lines.map(r=>({date:col(r,'date').trim(),type:col(r,'record_type').trim(),sleep:parseNum(col(r,'sleep_quality_1_10')),energy:parseNum(col(r,'morning_energy_1_10')),soreness:parseNum(col(r,'soreness_1_10')),workout:col(r,'workout_type').trim(),minutes:parseNum(col(r,'duration_min')),distance:parseNum(col(r,'distance_km')),incline:parseNum(col(r,'incline_pct')),item:col(r,'item').trim()||undefined,level:parseNum(col(r,'level')),day_level:parseNum(col(r,'day_level'))} as Entry)).filter(r=>/^\d{4}-\d{2}-\d{2}$/.test(r.date));
}

const fmtDate=(s:string)=>new Date(s+'T12:00:00').toLocaleDateString('en-IN',{day:'numeric',month:'short'});
const dates=(anchor:string,n:number)=>Array.from({length:n},(_,i)=>{const d=new Date(anchor+'T12:00:00');d.setDate(d.getDate()-(n-1-i));return d.toISOString().slice(0,10)});
const fmtPace=(m:number)=>{let t=Math.round(m*60);return `${Math.floor(t/60)}:${String(t%60).padStart(2,'0')}`};
const isRun=(w:string)=>/run|5k/i.test(w);
const fmtAvg=(v:number|null)=>v===null?'—':v.toFixed(1);
const levelLabel=(l:number|null)=>l===3?'multiple':l===2?'meal':l===1?'snack':'';

// Least-squares linear trend over reported values only, x = calendar-day index of the current view. Null when fewer than 2 reported values.
function linFit(vals:(number|null)[]){const pts=vals.map((v,i)=>v===null?null:{x:i,y:v as number}).filter(p=>p!==null) as {x:number;y:number}[];if(pts.length<2)return vals.map(()=>null);const n=pts.length,sx=pts.reduce((a,p)=>a+p.x,0),sy=pts.reduce((a,p)=>a+p.y,0),sxx=pts.reduce((a,p)=>a+p.x*p.x,0),sxy=pts.reduce((a,p)=>a+p.x*p.y,0),dn=n*sxx-sx*sx;if(dn===0)return vals.map(()=>null);const b=(n*sxy-sx*sy)/dn,a=(sy-b*sx)/n;return vals.map((_,i)=>a+b*i);}

const foodTitle=(d:{label:string;foodCount:number;food:Entry[]})=>d.foodCount===0?`${d.label}: not reported (unknown)`:`${d.label}: ${d.foodCount} event${d.foodCount>1?'s':''} · ${d.food.map(f=>`${f.item||'junk'}${f.level?` (${levelLabel(f.level)})`:''}`).join(', ')}`;

function App(){
  const [rows,setRows]=useState<Entry[]>([]),[loading,setLoading]=useState(true),[range,setRange]=useState<7|28>(7),[offset,setOffset]=useState(0),[picked,setPicked]=useState<string|null>(null),[err,setErr]=useState('');

  useEffect(()=>{fetch(`${import.meta.env.BASE_URL}data.json`,{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Data file unavailable');return r.json()}).then(data=>{if(!Array.isArray(data))throw Error('Invalid data file');setRows(data);setLoading(false)}).catch(()=>{setErr('Could not load the data file.');setLoading(false)})},[]);

  const anchor=useMemo(()=>rows.reduce((m,r)=>r.date>m?r.date:m,'2026-09-27'),[rows]);
  const end=useMemo(()=>{const d=new Date(anchor+'T12:00:00');d.setDate(d.getDate()+offset*range);return d.toISOString().slice(0,10)},[anchor,offset,range]);

  const view=useMemo(()=>{
    const dayList=dates(end,range);
    const base=dayList.map(date=>{
      const r=rows.filter(x=>x.date===date);
      const food=r.filter(x=>x.type==='food');
      return{date,label:fmtDate(date),
        sleep:r.find(x=>x.sleep!==null)?.sleep??null,
        energy:r.find(x=>x.energy!==null)?.energy??null,
        soreness:r.find(x=>x.soreness!==null)?.soreness??null,
        workoutDay:r.some(x=>x.type==='workout'||x.workout)?1:0,
        food};
    });
    const sleepFit=linFit(base.map(d=>d.sleep)),energyFit=linFit(base.map(d=>d.energy));
    return base.map((d,i)=>{
      // Food: occasion rows carry level (1 snack / 2 meal); daily declarations carry day_level (his explicit day rating, occasion count unknown). Day level = max of declared and occasion-computed.
      const occ=d.food.filter(f=>f.day_level==null);
      const decl=d.food.map(f=>f.day_level).filter((v):v is number=>v!=null);
      const occLevel=occ.length>=2?3:occ.length===1?(occ[0].level??null):null;
      const lvls=[...(occLevel!=null?[occLevel]:[]),...decl];
      const dayLevel=lvls.length?Math.max(...lvls):null;
      return{...d,sleepFit:sleepFit[i],energyFit:energyFit[i],foodCount:occ.length,foodDeclCount:decl.length,foodLevel:dayLevel};
    });
  },[rows,end,range]);

  const inView=rows.filter(r=>view.some(d=>d.date===r.date));
  const workouts=inView.filter(x=>x.type==='workout'||x.workout);
  const activeDays=[...new Set(workouts.map(x=>x.date))].length;
  const exerciseTier=range===7?(activeDays>=4?'green':activeDays===3?'orange':'red'):'neutral';
  const goodSleep=view.filter(d=>d.sleep!==null&&d.sleep>=7).length,loggedSleep=view.filter(d=>d.sleep!==null).length;
  const goodEnergy=view.filter(d=>d.energy!==null&&d.energy>=7).length,loggedEnergy=view.filter(d=>d.energy!==null).length;
  const avgSleep=loggedSleep?view.reduce((s,d)=>s+(d.sleep??0),0)/loggedSleep:null;
  const avgEnergy=loggedEnergy?view.reduce((s,d)=>s+(d.energy??0),0)/loggedEnergy:null;
  const runs=rows.filter(r=>isRun(r.workout)&&r.distance===6&&r.minutes!==null).sort((a,b)=>byDate(a.date,b.date));
  const runPoints=runs.map(r=>({date:r.date,label:fmtDate(r.date),pace:r.minutes!/r.distance!}));
  const pacePct=runPoints.length>=2?((runPoints[0].pace-runPoints.at(-1)!.pace)/runPoints[0].pace*100):null;
  const recent=rows.filter(x=>x.type==='workout'||x.workout).sort((a,b)=>byDate(b.date,a.date))[0];
  const selected=picked||view.at(-1)?.date||'';
  const workoutDates=[...new Set(workouts.map(w=>w.date))].sort();
  const avgGap=workoutDates.length>=2?workoutDates.slice(1).reduce((sum,d,i)=>sum+Math.round((new Date(d+'T12:00:00').getTime()-new Date(workoutDates[i]+'T12:00:00').getTime())/86400000),0)/(workoutDates.length-1):null;
  const todayIST=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const daysSinceLast=recent?Math.max(0,Math.floor((new Date(todayIST+'T12:00:00').getTime()-new Date(recent.date+'T12:00:00').getTime())/86400000)):null;

  const readinessVals=view.flatMap(d=>[d.sleep,d.energy,d.sleepFit,d.energyFit]).filter((v):v is number=>v!=null);
  const readinessFloor=readinessVals.length?Math.min(4,Math.floor(Math.min(...readinessVals))):4;
  // Uniformity system: every chart gets the SAME plot height with the SAME gridline pitch.
  // Each chart uses its own honest tick step; intermediate gridlines stay unlabeled.
  const GRID=42,ROWS=6;
  const chartH=GRID*ROWS+45;
  const exerTicks=Array.from({length:ROWS+1},(_,k)=>k/ROWS);
  const foodTicks=Array.from({length:ROWS+1},(_,k)=>k*0.5);
  const wakeTicks=Array.from({length:10-readinessFloor+1},(_,k)=>readinessFloor+k);
  const wakeH=GRID*Math.max(ROWS,10-readinessFloor)+45;
  const paceVals=runPoints.map(p=>p.pace);
  let paceStep=0.25;
  if(paceVals.length){
    const span=Math.max(...paceVals)-Math.min(...paceVals);
    while(paceStep*ROWS<span+0.001)paceStep*=2;
  }
  const paceLo=paceVals.length?Math.floor(Math.min(...paceVals)/paceStep)*paceStep:6;
  const paceHi=paceLo+paceStep*ROWS;
  const paceTicks=Array.from({length:ROWS+1},(_,k)=>paceLo+k*paceStep);
  const foodEvents=inView.filter(x=>x.type==='food'&&x.day_level==null);
  const foodDeclDays=view.filter(d=>d.foodDeclCount>0).length;
  const foodUnreported=view.filter(d=>d.foodCount===0&&d.foodDeclCount===0).length;
  const selectedFood=rows.filter(x=>x.date===selected&&x.type==='food');
  const lastFoodDate=rows.filter(x=>x.type==='food').map(x=>x.date).sort().at(-1);
  const daysSinceJunk=lastFoodDate?Math.max(0,Math.floor((new Date(todayIST+'T12:00:00').getTime()-new Date(lastFoodDate+'T12:00:00').getTime())/86400000)):null;

  const narrative=`Your last recorded workout was ${recent?fmtDate(recent.date):'not logged'}. ${loggedSleep?`${goodSleep} of ${loggedSleep} recorded nights scored at least 7/10.`:'Sleep quality has not been recorded.'} ${loggedEnergy?`${goodEnergy} of ${loggedEnergy} recorded mornings felt energetic.`:'Morning energy has not been recorded.'} ${pacePct===null?'A second timed 6K is needed to calculate pace change. Earlier 5K runs stay in the ledger and are not compared.':`Your 6K pace changed ${pacePct>0?'+':''}${pacePct.toFixed(1)}% from the first timed 6K.`}`;

  async function upload(f:File|null){if(!f)return;try{const r=parseCSV(await f.text());if(!r.length)throw Error('No dated rows found.');setRows(r);setOffset(0);setPicked(null);setErr('')}catch(e){setErr(e instanceof Error?e.message:'Could not read CSV')}}

  const maTooltip=(value:any,name:any,item:any)=>{
    if(item?.dataKey==='sleepFit'||item?.dataKey==='energyFit')return null;
    const p=item?.payload;
    if(item?.dataKey==='sleepFit')return[`${Number(value).toFixed(1)} · linear fit of reported days`,'Sleep linear trend'];
    if(item?.dataKey==='energyFit')return[`${Number(value).toFixed(1)} · linear fit of reported days`,'Energy linear trend'];
    return[value,name];
  };

  return <div className="shell">
    <div className="topline"><div className="brand"><span className="brandmark">✳</span> ATLAS <span className="separator">/</span> Naman</div></div>
    <header>
      <div><div className="kicker">YOUR TRAINING STORY</div><h1>Build the habit.<br/><em>See the gains.</em></h1></div>
      <div className="header-tools">
        <div className="switch"><button className={range===7?'on':''} onClick={()=>{setRange(7);setOffset(0);setPicked(null)}}>7 days</button><button className={range===28?'on':''} onClick={()=>{setRange(28);setOffset(0);setPicked(null)}}>28 days</button></div>
        <label className="import"><Upload size={15}/> Import ledger CSV<input type="file" accept=".csv,text/csv" onChange={e=>upload(e.target.files?.[0]||null)}/></label>
      </div>
    </header>
    {err&&<div className="error" role="alert">{err}</div>}
    {loading&&<div className="loading">Loading workout ledger…</div>}
    <div className="insight"><span className="insight-icon"><Activity size={22}/></span><p>{narrative}</p></div>
    <div className="stats">
      <article className="stat"><div className="stat-label"><Moon size={17}/> GOOD SLEEP</div><strong>{loggedSleep?goodSleep:'—'}<small>/{range} days</small></strong><span>{loggedSleep?`${loggedSleep} days with ratings`:'No ratings yet'} · green at 7+/10</span></article>
      <article className="stat"><div className="stat-label"><Sun size={17}/> ENERGETIC MORNINGS</div><strong>{loggedEnergy?goodEnergy:'—'}<small>/{range} days</small></strong><span>{loggedEnergy?`${loggedEnergy} mornings rated`:'No ratings yet'} · green at 7+/10</span></article>
      <article className={`stat exercise ${exerciseTier}`}><div className="stat-label"><Activity size={17}/> WORKOUT DAYS</div><strong>{activeDays}<small>/{range} days</small></strong><span>{range===7?activeDays>=4?"Green · 4+ workout days":activeDays===3?"Orange · 3 workout days":"Red · fewer than 3 workout days":"Weekly goal: 4+ days green, 3 orange, fewer red"}</span></article>
      <article className="stat"><div className="stat-label"><Timer size={17}/> 6K PACE</div><strong>{pacePct===null?'—':`${pacePct>0?'+':''}${pacePct.toFixed(1)}`}<small>% change</small></strong><span>{runs.length===1?`1 timed 6K baseline · ${fmtPace(runPoints[0].pace)}/km`:runs.length===0?'No timed 6K runs':`${runs.length} timed 6K runs recorded`}</span></article>
    </div>
    <div className="section-head">
      <div><div className="kicker">THE WHOLE PICTURE</div><h2>Sleep, energy, food, and what training costs.</h2></div>
      <div className="date-controls"><button aria-label="Previous period" onClick={()=>{setOffset(x=>x-1);setPicked(null)}}><ChevronLeft size={18}/></button><span>{fmtDate(view[0].date)} – {fmtDate(view.at(-1)!.date)}</span><button aria-label="Next period" disabled={offset>=0} onClick={()=>{setOffset(x=>x+1);setPicked(null)}}><ChevronRight size={18}/></button></div>
    </div>
    <div className="chart-grid">
      <article className="chart-card hero-chart">
        <div className="chart-heading"><div><span className="eyebrow">01 / READINESS SIGNALS</span><h3>How you woke up</h3></div><span className="chart-note">1–10 · gaps = no answer</span></div>
        <div className="chart-wrap" style={{height:wakeH}}><ResponsiveContainer width="100%" height="100%">
          <AreaChart data={view} margin={{top:12,right:12,bottom:3,left:-23}} onClick={s=>s?.activeLabel&&setPicked(view.find(v=>v.label===s.activeLabel)?.date||null)}>
            <defs><linearGradient id="sleepFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#78bf9d" stopOpacity=".22"/><stop offset="100%" stopColor="#78bf9d" stopOpacity="0"/></linearGradient></defs>
            <CartesianGrid stroke="#e9eeeb" vertical={false}/>
            <XAxis dataKey="label" tick={{fontSize:11,fill:'#88958e'}} axisLine={false} tickLine={false} interval={range===7?0:4}/>
            <YAxis domain={[readinessFloor,10]} ticks={wakeTicks} tick={{fontSize:10,fill:'#88958e'}} axisLine={false} tickLine={false}/>
            <Tooltip contentStyle={{borderRadius:12,border:'1px solid #e1e9e4',fontSize:12}} formatter={maTooltip}/>
            <Legend iconType="circle" wrapperStyle={{fontSize:12}}/>
            <ReferenceLine y={7} stroke="#8dad9c" strokeDasharray="4 5"/>
            <Area isAnimationActive={false} type="monotone" dataKey="sleep" name="Sleep quality" stroke="#5baa82" strokeWidth={3} fill="url(#sleepFill)" connectNulls={false} dot={{r:3}} activeDot={{r:6}}/>
            <Area type="monotone" dataKey="energy" name="Morning energy" stroke="#efa758" strokeWidth={3} fill="none" connectNulls={false} dot={{r:3}} activeDot={{r:6}}/>
            <Area legendType="none" type="linear" dataKey="sleepFit" name="Sleep linear trend" stroke="#347e63" strokeWidth={2} strokeDasharray="5 4" fill="none" connectNulls={false} dot={false}/>
            <Area legendType="none" type="linear" dataKey="energyFit" name="Energy linear trend" stroke="#c9822f" strokeWidth={2} strokeDasharray="5 4" fill="none" connectNulls={false} dot={false}/>
          </AreaChart>
        </ResponsiveContainer></div>
        <div className="gap-metrics"><div><b>{fmtAvg(avgSleep)}</b><span>sleep average · this view</span></div><div><b>{fmtAvg(avgEnergy)}</b><span>energy average · this view</span></div></div>
        <div className="mini-caption"><span>dashed = linear trend of reported days</span><span className="sep">·</span><span>gaps = no answer</span></div>
      </article>
      <article className="chart-card">
        <div className="chart-heading"><div><span className="eyebrow">02 / FREQUENCY</span><h3>How consistent you’ve been with exercise</h3></div><span className="chart-note">workout day = 1, even with multiple activities</span></div>
        <div className="chart-wrap" style={{height:chartH}}><ResponsiveContainer width="100%" height="100%">
          <BarChart data={view} margin={{top:12,right:3,bottom:3,left:-28}} onClick={s=>s?.activeLabel&&setPicked(view.find(v=>v.label===s.activeLabel)?.date||null)}>
            <CartesianGrid stroke="#e9eeeb" vertical={false}/>
            <XAxis dataKey="label" tick={{fontSize:10,fill:'#88958e'}} axisLine={false} tickLine={false} interval={range===7?0:4}/>
            <YAxis domain={[0,1]} ticks={exerTicks} tickFormatter={(v:number)=>(Math.abs(v)<1e-9?'0':Math.abs(v-1)<1e-9?'1':'')} tick={{fontSize:10,fill:'#88958e'}} axisLine={false} tickLine={false}/>
            <Tooltip contentStyle={{borderRadius:12,border:'1px solid #e1e9e4',fontSize:12}}/>
            <Bar isAnimationActive={false} dataKey="workoutDay" name="Workout day" fill="#5baa82" radius={[6,6,0,0]} maxBarSize={34}/>
          </BarChart>
        </ResponsiveContainer></div>
        <div className="gap-metrics"><div><b>{daysSinceLast??"—"} <small>days</small></b><span>since your last workout</span></div><div><b>{avgGap===null?"—":avgGap.toFixed(1)} <small>days</small></b><span>average break between workout days in this view{workoutDates.length<2?" · needs two reported days":""}</span></div></div>
        <p className="chart-foot">Each bar means a reported workout day, even if multiple activities happened. Unreported days remain unknown.</p>
      </article>
    </div>
    <article className="chart-card food-card">
      <div className="chart-heading"><div><span className="eyebrow">03 / FOOD</span><h3>How often you ate junk</h3></div><span className="chart-note">1 snack · 2 meal · 3 multiple in a day</span></div>
      <div className="chart-wrap" style={{height:chartH}}><ResponsiveContainer width="100%" height="100%">
        <BarChart data={view} margin={{top:12,right:3,bottom:3,left:-28}} onClick={s=>s?.activeLabel&&setPicked(view.find(v=>v.label===s.activeLabel)?.date||null)}>
          <CartesianGrid stroke="#e9eeeb" vertical={false}/>
          <XAxis dataKey="label" tick={{fontSize:10,fill:'#88958e'}} axisLine={false} tickLine={false} interval={range===7?0:4}/>
          <YAxis domain={[0,3]} ticks={foodTicks} tickFormatter={(v:number)=>(Number.isInteger(v)?String(v):'')} tick={{fontSize:10,fill:'#88958e'}} axisLine={false} tickLine={false}/>
          <Tooltip contentStyle={{borderRadius:12,border:'1px solid #e1e9e4',fontSize:12}} cursor={{fill:'#f1f5f2'}} formatter={(v:any,_n:any,item:any)=>{const p=item?.payload;const bits:string[]=[];if(p?.foodCount>0)bits.push(`${p.foodCount} known event${p.foodCount>1?'s':''}`);if(p?.foodDeclCount>0)bits.push('day rating, count unknown');const main=p?.foodDeclCount>0&&p?.foodCount===0?'day rating':levelLabel(Number(v));return[main+(bits.length?` · ${bits.join(' · ')}`:''),'Level '+v];}}/>
          <Bar isAnimationActive={false} dataKey="foodLevel" name="Junk food level" radius={[6,6,0,0]} maxBarSize={34}>
            {view.map(d=><Cell key={d.date} fill={d.foodLevel===3?'#d9534a':d.foodLevel===2?'#ef9a3c':'#f2c94c'}/>)}
          </Bar>
        </BarChart>
      </ResponsiveContainer></div>
      <div className="food-legend"><span><i style={{background:'#f2c94c'}}/>1 snack</span><span><i style={{background:'#ef9a3c'}}/>2 meal</span><span><i style={{background:'#d9534a'}}/>3 multiple in a day</span></div>
      <div className="gap-metrics single"><div><b>{daysSinceJunk===null?"—":daysSinceJunk} <small>days</small></b><span>{daysSinceJunk===null?'No junk food logged yet':`since your last logged junk day (${fmtDate(lastFoodDate!)})`}</span></div></div>
      <p className="chart-foot">{foodUnreported} day{foodUnreported===1?'':'s'} unreported, unknown not zero.{foodEvents.length>0||foodDeclDays>0?' Tap a bar for details.':''} Same dates as the exercise chart above.</p>
    </article>
    <div className="lower">
      <article className="chart-card run-card">
        <div className="chart-heading"><div><span className="eyebrow">04 / 6K PERFORMANCE</span><h3>Tracking my 6K pace</h3></div><span className="chart-note">mm:ss per km · lower is faster</span></div>
        <div className="chart-wrap" style={{height:chartH}}><ResponsiveContainer width="100%" height="100%">
          <LineChart data={runPoints} margin={{top:12,right:20,bottom:3,left:-15}}>
            <CartesianGrid stroke="#e9eeeb" vertical={false}/>
            <XAxis dataKey="label" tick={{fontSize:11,fill:'#88958e'}} axisLine={false} tickLine={false}/>
            <YAxis domain={[paceLo,paceHi]} ticks={paceTicks} tickFormatter={(v:number)=>(Math.abs(v/0.5-Math.round(v/0.5))<1e-9?fmtPace(v):'')} tick={{fontSize:10,fill:'#88958e'}} axisLine={false} tickLine={false}/>
            <Tooltip formatter={(v:any)=>[`${fmtPace(Number(v))} /km`,'Pace']} contentStyle={{borderRadius:12,border:'1px solid #e1e9e4',fontSize:12}}/>
            <Line isAnimationActive={false} type="monotone" dataKey="pace" name="Pace" stroke="#7a97cc" strokeWidth={3} dot={{r:6,fill:'#7a97cc'}}/>
          </LineChart>
        </ResponsiveContainer></div>
        <p className="chart-foot">{runPoints.length<2?'One timed 6K is a baseline, not an improvement trend. Earlier 5K runs are not compared.':'Pace change uses first and latest timed 6Ks in this ledger.'}</p>
      </article>
      <article className="day-card">
        <span className="eyebrow">TAP A DAY IN THE CHARTS</span>
        <h3>{fmtDate(selected)}</h3>
        <div className="day-values">{(['sleep','energy','soreness'] as const).map(k=>{const v=view.find(x=>x.date===selected)?.[k]??null;const col=k==='soreness'&&v!==null?(v>=7?'#c8453d':v>=4?'#c9822f':'#347e63'):undefined;return <div key={k}><span style={{textTransform:k==='soreness'?'none':undefined}}>{k==='soreness'?'Soreness (higher = worse)':k}</span><b style={col?{color:col}:undefined}>{v??'—'} <small>/10</small></b></div>})}</div>
        <div className="day-events">
          {rows.filter(x=>x.date===selected&&(x.type==='workout'||x.workout)).map((e,i)=><span key={'w'+i}>{e.workout}{e.minutes!==null?` · ${e.minutes} min`:""}{e.minutes!==null&&e.distance===6?` · ${fmtPace(e.minutes/e.distance)}/km`:""}</span>)}
          {!rows.some(x=>x.date===selected&&(x.type==='workout'||x.workout))&&<span>No workout recorded; not assumed rest.</span>}
          {selectedFood.map((f,i)=><span key={'f'+i} className="food-event"><UtensilsCrossed size={11}/> {f.item||'junk'}{f.day_level!=null?` · reported as level ${f.day_level} day (count unknown)`:f.level?` · ${levelLabel(f.level)}`:""}</span>)}
        </div>
      </article>
    </div>
    <footer><Info size={14}/> CSV imports stay in your browser memory. <a href="https://21st.dev/@shadcnspace/components/card-12">21st.dev inspiration</a> · <a href="https://mobbin.com/explore/mobile/app-categories/health-fitness">Mobbin inspiration</a></footer>
  </div>;
}

createRoot(document.getElementById('root')!).render(<App/>);
