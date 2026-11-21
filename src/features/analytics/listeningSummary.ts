export type ListeningSummary = {
  generatedAt: number;
  days: number;
  startAt?: number;
  comparison?: { startAt: number; endAt: number; totalMs: number; sessions: number; changePercent: number | null; byDay: Array<{ day: string; ms: number }> };
  totalMs: number;
  sessions: number;
  byDay: Array<{ day: string; ms: number }>;
  bySong: Array<{ id: string; ms: number }>;
};

const nonnegativeInteger = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0;
const object = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

/** Reject malformed remote or cached snapshots instead of displaying incorrect totals. */
export function isListeningSummary(value: unknown, expectedDays?: number): value is ListeningSummary {
  if (!object(value) || !nonnegativeInteger(value.generatedAt) || value.generatedAt > 8640000000000000 || ![7, 30, 90].includes(Number(value.days)) ||
      typeof value.days !== "number" || expectedDays !== undefined && value.days !== expectedDays) return false;
  const days = value.days;
  const currentStart = Math.floor(value.generatedAt / 86400000) * 86400000 - (days - 1) * 86400000;
  const validPeriod = (period: Record<string, unknown>, start: number) => {
    if (!nonnegativeInteger(period.totalMs) || !nonnegativeInteger(period.sessions) ||
        Boolean(period.totalMs) !== Boolean(period.sessions) || period.sessions > period.totalMs || !Array.isArray(period.byDay) || period.byDay.length !== days) return false;
    let total = 0;
    for (let index = 0; index < days; index++) {
      const day = period.byDay[index];
      if (!object(day) || !nonnegativeInteger(day.ms) || day.day !== new Date(start + index * 86400000).toISOString().slice(0, 10)) return false;
      total += day.ms;
    }
    return total === period.totalMs;
  };
  if (!validPeriod(value, currentStart) || !Array.isArray(value.bySong)) return false;
  let total = 0;
  const ids = new Set<string>();
  for (const song of value.bySong) {
    if (!object(song) || typeof song.id !== "string" || !song.id || ids.has(song.id) || !nonnegativeInteger(song.ms) || song.ms === 0) return false;
    ids.add(song.id);
    total += song.ms;
  }
  if (total !== value.totalMs) return false;
  if (value.comparison !== undefined) {
    const previous = value.comparison;
    const start = currentStart - days * 86400000;
    if (!object(previous) || !validPeriod(previous, start) || previous.startAt !== start || previous.endAt !== currentStart) return false;
    const expected = Number(previous.totalMs) > 0 ? (Number(value.totalMs) - Number(previous.totalMs)) / Number(previous.totalMs) * 100 : null;
    if (expected === null ? previous.changePercent !== null : typeof previous.changePercent !== "number" || !Number.isFinite(previous.changePercent) || Math.abs(previous.changePercent - expected) > 0.000001) return false;
  }
  return true;
}


/** Calendar summaries are measured from valid, persisted playback events, not track-length estimates. */
export type ListeningCalendarRange = "week" | "month" | "year";
export type ListeningCalendarPeriod = {
  startAt:number;endAt:number;totalMs:number;sessions:number;activeDays:number;
  byBucket:Array<{id:string;ms:number}>;
};
export type ListeningCalendarSummary = ListeningCalendarPeriod & {
  range:ListeningCalendarRange;offset:number;generatedAt:number;partial:boolean;
  bySong:Array<{id:string;ms:number}>;
  comparison:ListeningCalendarPeriod & {comparableTotalMs:number;changePercent:number|null};
};
export function isListeningCalendarSummary(value:unknown, expected?:{range:ListeningCalendarRange;offset:number}):value is ListeningCalendarSummary {
  if(!object(value)||!["week","month","year"].includes(String(value.range))||
     !nonnegativeInteger(value.offset)||value.offset>120||
     !nonnegativeInteger(value.generatedAt)||value.generatedAt>8640000000000000||
     typeof value.partial!=="boolean"||
     expected&&(value.range!==expected.range||value.offset!==expected.offset))return false;
  const range=value.range as ListeningCalendarRange;
  const now=new Date(value.generatedAt);
  const year=now.getUTCFullYear(),month=now.getUTCMonth();
  let start:number,end:number,previousStart:number;
  if(range==="year"){start=Date.UTC(year-value.offset,0,1);end=Date.UTC(year-value.offset+1,0,1);previousStart=Date.UTC(year-value.offset-1,0,1);}
  else if(range==="month"){start=Date.UTC(year,month-value.offset,1);end=Date.UTC(year,month-value.offset+1,1);previousStart=Date.UTC(year,month-value.offset-1,1);}
  else {const monday=Date.UTC(year,month,now.getUTCDate())-((now.getUTCDay()+6)%7)*86400000;
    start=monday-value.offset*7*86400000;end=start+7*86400000;previousStart=start-7*86400000;}
  if(value.partial!==(value.generatedAt<end&&value.generatedAt>=start))return false;
  const verify=(v:unknown,s:number,e:number)=>{
    if(!object(v)||v.startAt!==s||v.endAt!==e||!nonnegativeInteger(v.totalMs)||
       !nonnegativeInteger(v.sessions)||!nonnegativeInteger(v.activeDays)||
       Boolean(v.totalMs)!==Boolean(v.sessions)||v.sessions>v.totalMs||
       !Array.isArray(v.byBucket))return false;
    const keys:string[]=[];
    for(let d=s;d<e;){
      const iso=new Date(d).toISOString();
      keys.push(iso.slice(0,range==="year"?7:10));
      d=range==="year"?Date.UTC(new Date(d).getUTCFullYear(),new Date(d).getUTCMonth()+1,1):d+86400000;
    }
    if(keys.length!==v.byBucket.length||v.activeDays>Math.floor((e-s)/86400000))return false;
    let total=0;
    for(let i=0;i<keys.length;i++){const row=v.byBucket[i];if(!object(row)||row.id!==keys[i]||!nonnegativeInteger(row.ms))return false;total+=row.ms;}
    return total===v.totalMs;
  };
  if(!verify(value,start,end)||!verify(value.comparison,previousStart,start)||!object(value.comparison)||!Array.isArray(value.bySong))return false;
  const seen=new Set<string>();let total=0;
  for(const song of value.bySong){if(!object(song)||typeof song.id!=="string"||!song.id||seen.has(song.id)||!nonnegativeInteger(song.ms)||song.ms===0)return false;seen.add(song.id);total+=song.ms;}
  if(total!==value.totalMs)return false;
  const previous=value.comparison.comparableTotalMs;
  if(!nonnegativeInteger(previous)||previous>(value.comparison.totalMs as number)||
     !value.partial&&previous!==value.comparison.totalMs)return false;
  const comparison=value.comparison.changePercent;
  const calculated=previous>0?((value.totalMs as number)-previous)/previous*100:null;
  return calculated===null?comparison===null:typeof comparison==="number"&&Number.isFinite(comparison)&&Math.abs(comparison-calculated)<0.000001;
}
