import type { RealDocument } from "../types";
import { fetchTextWithRetry } from "../../watch/sources/_http";
export function parseNbogPublications(html:string):RealDocument[]{const out:RealDocument[]=[];for(const m of html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)){const title=m[2].replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();if(!/NBOG|BPG|best practice/i.test(title))continue;const url=new URL(m[1],"https://www.nbog.eu/resources/").toString();const id=title.match(/NBOG\s*(?:BPG)?\s*\d{4}[-/]\d+/i)?.[0]??url;out.push({id,title,source:"NBOG",url,publishedAt:null,content:title});}return out;}
export async function fetchNbogPublications(){return parseNbogPublications(await fetchTextWithRetry("https://www.nbog.eu/resources/",{timeoutMs:30000}));}
