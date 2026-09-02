import type { RealDocument } from "../types";
import { fetchTextWithRetry } from "../../watch/sources/_http";
export function parseEudamedAlerts(raw:string):RealDocument[]{const data=JSON.parse(raw);const rows=data.content??data.results??data.items??[];return rows.map((r:any)=>({id:String(r.referenceNumber??r.id),title:r.title??r.subject??"EUDAMED safety notice",source:"EUDAMED",url:r.url??"https://ec.europa.eu/tools/eudamed/",publishedAt:r.modifiedDate??r.publicationDate??null,content:JSON.stringify(r).slice(0,5000)}));}
export async function fetchEudamedAlerts(){const url="https://ec.europa.eu/tools/eudamed/api/mc/mcsearch?lang=fr&pageSize=20&sortColumn=modifiedDate&sortOrder=DESC";return parseEudamedAlerts(await fetchTextWithRetry(url,{timeoutMs:30000}));}
