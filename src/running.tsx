import React,{useEffect,useState}from'react';
import{createRoot}from'react-dom/client';
import{LineChart,Line,XAxis,YAxis,CartesianGrid,Tooltip,ResponsiveContainer}from'recharts';
import{Activity,Footprints,HeartPulse,Timer,UtensilsCrossed,Flag,Gauge,Mountain,ClipboardCheck}from'lucide-react';
import './style.css';

type TypeBucket={sessions:number;km?:number;time_min:number;avg_pace?:string|null};
type RunningData={
  updated:string;
  weekly:{
    week_start:string;
    data_status?:string;window_complete?:boolean;
    totals:{km:number|null;moving_time_min:number|null};
    by_type:Record<string,TypeBucket>;
    pace_delta_wow:Record<string,string|null>;
    vo2max:{current:number|null;trend:{week:string;value:number}[]};
    zone2:{minutes:number;pct_of_moving:number;delta_minutes_wow:number|null};
    resting_hr:{avg_7d:number|null;rate_of_change_per_week:number|null};
    cheat_score:{status?:string;points:number|null;pct:number|null;known_deductions?:number;penalties:{date:string;level:number;cost:number}[];rules?:{l1_penalty:number;l2_penalty:number;l3_penalty?:number}};
    recovery_context:boolean;
  };
  monthly:{
    lactate_threshold:{status:string;history:{date:string;pace:string;hr:number}[]};
    acute_load:{source:string;current:number|null;rate_of_change:number|null};
    readiness_audit:{observations:number;tp:number;fp:number;tn:number;fn:number;note:string};
  };
  targets:{date:string;label:string}[];
};

const TYPES:[string,string][]=[['strength','Strength training'],['recovery','Recovery runs'],['5k','5Ks'],['tempo','Tempos'],['intervals','Intervals'],['threshold','Threshold'],['unspecified','Not yet classified']];
const RUN_TYPES=['recovery','5k','tempo','intervals','threshold'];
const fmtPace=(p:string|null|undefined)=>p?p:'Pending';
const fmtMin=(m:number)=>m>=60?`${Math.floor(m/60)}h ${m%60?`${m%60}m`:''}`.trim():`${m} min`;
const fmtWeek=(iso:string)=>{const d=new Date(iso+'T00:00:00');return d.toLocaleDateString('en-GB',{day:'numeric',month:'short'})};

function App(){
  const[data,setData]=useState<RunningData|null>(null);
  const[err,setErr]=useState<string|null>(null);
  useEffect(()=>{fetch(`${import.meta.env.BASE_URL}running-data.json`,{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('missing');return r.json()}).then(setData).catch(()=>setErr('Could not load the running data file.'))},[]);
  if(err)return<div className="shell"><p className="error">{err}</p></div>;
  if(!data)return<div className="shell"><p style={{padding:40,color:'#7d8b7e'}}>Loading…</p></div>;
  const w=data.weekly,m=data.monthly;
  const synced=w.data_status?w.data_status!=='pending':((w.totals.km??0)>0||(w.totals.moving_time_min??0)>0||w.vo2max.current!==null||w.resting_hr.avg_7d!==null);
  const cs=w.cheat_score;
  const audit=m.readiness_audit;
  return<div className="shell">
    <div className="topline">
      <div className="brand"><span className="brandmark"><Footprints size={16}/></span>TRAINING ATLAS<span className="separator">·</span>RUNNING</div>
      <div className="private-pill">PUBLIC PAGE · PAGE 1 UNCHANGED</div>
    </div>
    <header>
      <div>
        <div className="kicker">GARMIN FORERUNNER 265 · BASELINE PHASE</div>
        <h1>Running <em>dashboard</em></h1>
      </div>
      <div className="header-tools"><a className="import" href="./index.html">Page 1: daily atlas</a></div>
    </header>
    {!synced&&<div className="insight" style={{marginBottom:18}}><div className="insight-icon"><Activity size={18}/></div><p>Waiting for the first Garmin sync. Pair the Forerunner 265 in the Garmin Connect app and sync once. Metrics appear as the watch collects enough eligible data, and availability varies by metric. Everything below fills in from real data as it arrives.</p></div>}

    <div className="stats">
      <article className="stat exercise green"><div className="stat-label"><Footprints size={15}/> THIS WEEK · DISTANCE</div><strong>{(w.totals.km??0)>0?w.totals.km!.toFixed(1):'Pending'}<small>{(w.totals.km??0)>0?' km':''}</small></strong><span>week of {fmtWeek(w.week_start)}</span></article>
      <article className="stat exercise green"><div className="stat-label"><Timer size={15}/> THIS WEEK · MOVING TIME</div><strong>{(w.totals.moving_time_min??0)>0?fmtMin(w.totals.moving_time_min!):'Pending'}</strong><span>all activities, one bucket each</span></article>
      <article className="stat exercise green"><div className="stat-label"><Gauge size={15}/> VO2 MAX</div><strong>{w.vo2max.current??'Pending'}</strong><span>Garmin's own estimate · needs eligible outdoor GPS runs</span></article>
      <article className={`stat exercise ${(cs.pct??100)>=86?'green':(cs.pct??100)>=67?'orange':'red'}`}><div className="stat-label"><UtensilsCrossed size={15}/> CHEAT SCORE</div><strong>{`${cs.pct}%`}<small>{` · ${cs.points}/21`}</small></strong><span>21 points a week · snack −1 · meal −2 · level 3 −3</span></article>
    </div>

    <div className="section-head"><div><div className="kicker">EVERY WEEK</div><h2>Volume, pace, zone 2 and recovery signals.</h2></div></div>

    <div className="chart-grid">
      <article className="chart-card">
        <div className="chart-heading"><div><div className="kicker">01 / VOLUME BY TYPE</div><h3>Kilometres and time, split by run type</h3></div><span className="chart-note">week of {fmtWeek(w.week_start)}</span></div>
        <table className="type-table"><thead><tr><th>Type</th><th>Sessions</th><th>Distance</th><th>Time</th><th>Avg pace</th></tr></thead><tbody>
          {TYPES.map(([k,label])=>{const b=w.by_type[k];const isStrength=k==='strength';return<tr key={k}>
            <td>{label}</td><td>{b.sessions||'Pending'}</td>
            <td>{isStrength?'time only':(b.km?`${b.km.toFixed(1)} km`:'Pending')}</td>
            <td>{b.time_min?fmtMin(b.time_min):'Pending'}</td>
            <td>{isStrength?'time only':k==='unspecified'?'out of pace trends':fmtPace(b.avg_pace)}</td></tr>})}
        </tbody></table>
        <p className="chart-foot">One bucket per activity, so totals never double count. Strength contributes time, not distance or pace. "5K" is a distance, "recovery" is a purpose; your tag decides the bucket.</p>
      </article>

      <article className="chart-card">
        <div className="chart-heading"><div><div className="kicker">02 / PACE CHANGE</div><h3>Week on week, by run type</h3></div><span className="chart-note">min:sec per km</span></div>
        <table className="type-table"><thead><tr><th>Type</th><th>Change vs last week</th></tr></thead><tbody>
          {RUN_TYPES.map(k=><tr key={k}><td>{TYPES.find(t=>t[0]===k)![1]}</td><td>{w.pace_delta_wow[k]??'Pending'}</td></tr>)}
        </tbody></table>
        <p className="chart-foot">{w.recovery_context?'This is a recovery-tagged week — a slower number here is deliberate, not decline.':'Empty cells mean no run of that type this week or last; nothing is interpolated.'}</p>
      </article>
    </div>

    <div className="lower">
      <article className="chart-card">
        <div className="chart-heading"><div><div className="kicker">03 / AEROBIC ENGINE</div><h3>VO2 max trend and zone 2</h3></div></div>
        {w.vo2max.trend.length>1?<div className="chart-wrap short"><ResponsiveContainer width="100%" height="100%"><LineChart data={w.vo2max.trend} margin={{top:6,right:8,bottom:0,left:-18}}><CartesianGrid stroke="#eef3ee" vertical={false}/><XAxis dataKey="week" tick={{fontSize:10,fill:'#8a978d'}} tickLine={false} axisLine={false}/><YAxis domain={['dataMin - 1','dataMax + 1']} tick={{fontSize:10,fill:'#8a978d'}} tickLine={false} axisLine={false}/><Tooltip/><Line type="monotone" dataKey="value" stroke="#5baa82" strokeWidth={2.5} dot={{r:3,fill:'#5baa82'}}/></LineChart></ResponsiveContainer></div>
        :<div className="pending-box">The VO2 max trend appears once the watch has enough eligible outdoor GPS runs with heart rate; Garmin decides when its estimate updates, so availability varies. Single weeks jump around, so this shows the multi-week trend, not one week vs the next.</div>}
        <div className="gap-metrics">
          <div><b>{w.zone2.minutes>0?fmtMin(w.zone2.minutes):'Pending'} <small>{w.zone2.minutes>0?'in zone 2':''}</small></b><span>{w.zone2.pct_of_moving>0?`${w.zone2.pct_of_moving}% of moving time`:''}{w.zone2.delta_minutes_wow!==null?` · ${w.zone2.delta_minutes_wow>0?'+':''}${w.zone2.delta_minutes_wow} min vs last week`:'week of '+fmtWeek(w.week_start)}</span></div>
          <div><b>{w.resting_hr.avg_7d??'Pending'} <small>resting HR</small></b><span>7-day average{w.resting_hr.rate_of_change_per_week!==null?` · ${w.resting_hr.rate_of_change_per_week>0?'+':''}${w.resting_hr.rate_of_change_per_week}/week`:''}</span></div>
        </div>
      </article>

      <article className="chart-card">
        <div className="chart-heading"><div><div className="kicker">04 / CHEAT SCORE</div><h3>21 points a week, spent on junk</h3></div><span className="chart-note">{`${cs.pct}%`}</span></div>
        {cs.penalties.length>0?<table className="type-table"><thead><tr><th>Day</th><th>Event</th><th>Cost</th></tr></thead><tbody>
          {cs.penalties.map((p,i)=><tr key={i}><td>{fmtWeek(p.date)}</td><td>{p.level===1?'snack':p.level===2?'meal':'multiple'}</td><td>−{p.cost}</td></tr>)}
        </tbody></table>
        :<div className="pending-box">No penalties logged this week. Days with no food log count zero penalty because that is how the score is designed ("21 out of 21 naturally"), not because those days are verified clean. Starting at 21 is the assumed baseline, not proof. Atlas page 1 keeps treating unlogged days as unknown.</div>}
        <p className="chart-foot">Per event, as you defined it: each logged level-1 event costs 1 point, each level-2 event costs 2, each level-3 event costs 3. The score is always a percentage of 21 points for the calendar week, Monday to Sunday. No daily cap. The starting 21 is the assumed baseline, not proof that unlogged days were clean.</p>
      </article>
    </div>

    <div className="section-head" style={{marginTop:36}}><div><div className="kicker">EVERY MONTH</div><h2>Slower signals: threshold, load, and whether readiness is honest.</h2></div></div>
    <div className="chart-grid three">
      <article className="chart-card">
        <div className="chart-heading"><div><div className="kicker">05 / LACTATE THRESHOLD</div><h3>Month-to-month change</h3></div></div>
        <div className="pending-box">{m.lactate_threshold.status==='pending_sensor'?<>Pending a compatible sensor. The Forerunner 265 measures lactate threshold only with a chest heart-rate strap (per Garmin's manual); wrist heart rate alone will not produce it. If a strap is already paired, auto-detection works during hard steady runs — no formal test needed. Everything else on this page works without it.</>:'Tracking from Garmin data.'}</div>
        {m.lactate_threshold.history.length>0&&<table className="type-table"><thead><tr><th>Month</th><th>Threshold pace</th><th>HR</th></tr></thead><tbody>{m.lactate_threshold.history.map((h,i)=><tr key={i}><td>{h.date}</td><td>{h.pace}</td><td>{h.hr}</td></tr>)}</tbody></table>}
      </article>
      <article className="chart-card">
        <div className="chart-heading"><div><div className="kicker">06 / ACUTE LOAD</div><h3>Training load change</h3></div></div>
        <div className="gap-metrics single"><div><b>{m.acute_load.current??'Pending'} <small>Garmin Acute Load</small></b><span>{m.acute_load.rate_of_change!==null?`${m.acute_load.rate_of_change>0?'+':''}${m.acute_load.rate_of_change} vs last month`:'appears once Garmin has a few days of activities'} · source: Garmin Connect</span></div></div>
        <p className="chart-foot">This pulls Garmin's own Acute Load. Only if that value proves unreachable would we switch to our own clearly-labelled "7-day load index", and you would be told first.</p>
      </article>
      <article className="chart-card">
        <div className="chart-heading"><div><div className="kicker">07 / READINESS AUDIT</div><h3>Does readiness predict the good days?</h3></div></div>
        <div className="gap-metrics single"><div><b>{audit.observations} <small>comparable efforts</small></b><span>{audit.observations>0?`${audit.tp} confirmed · ${audit.fp} false alarms · ${audit.fn} missed good days · ${audit.tn} confirmed rest`:'starts counting after the first synced runs'}</span></div></div>
        <p className="chart-foot">The outcome is fixed in advance: pace on your usual 6K route under similar conditions, or a monthly 5K time trial, against Garmin's own readiness bands. A pattern check, not statistics. Expect a couple of months of comparable efforts before it is worth reading, and it reports association, never cause.</p>
      </article>
    </div>

    <div className="section-head" style={{marginTop:36}}><div><div className="kicker">TARGETS</div><h2>What this page is building toward.</h2></div></div>
    <div className="chart-grid">
      {data.targets.map((t,i)=><article className="chart-card target" key={i}>
        <div className="chart-heading"><div><div className="kicker">{i===0?<Flag size={10} style={{display:'inline'}}/>:'·'} {t.date.toUpperCase()}</div><h3>{t.label}</h3></div><div className="insight-icon" style={{background:'#e2eee6',color:'#347e63'}}>{i===0?<Mountain size={18}/>:<Flag size={18}/>}</div></div>
        <p className="chart-foot">{i===0?'The switch from baseline to build gets decided with evidence: weekly volume, acute load, resting heart rate trend and zone-2 share. The decision stays yours, and the shin recovery from 18 Oct is part of it. Nothing here assumes load should increase.':'Half marathon target from Nike Run Club. Year pinned down when it starts mattering for planning.'}</p>
      </article>)}
    </div>

    <footer>
      <ClipboardCheck size={12}/> Data: nightly pull from Garmin Connect into the private ledger; only these computed metrics are public. Watch: Forerunner 265. Updated {data.updated.slice(0,10)}. <a href="./index.html">Page 1: daily atlas</a> stays exactly as it is.
    </footer>
  </div>;
}

createRoot(document.getElementById('root')!).render(<App/>);
