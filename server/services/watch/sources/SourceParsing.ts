import { createHash } from "crypto";
import { safeText } from "../utils";

export function stripHtml(input: string): string {
  return safeText(input.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, " "));
}

export function decodeXml(input: string): string {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'");
}

export function tagValue(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? decodeXml(match[1].trim()) : "";
}

export function linkHref(xml: string): string {
  return decodeXml(xml.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*\/?>/i)?.[1]?.trim() ?? tagValue(xml, "link"));
}

export function stableOfficialId(sourceId: string, title: string, publishedAt: Date | null): string {
  return createHash("sha256").update([sourceId, title, publishedAt?.toISOString() ?? ""].join("|")).digest("hex");
}

export function parseRssItems(xml: string): string[] {
  return xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? [];
}

export function parseAtomEntries(xml: string): string[] {
  return xml.match(/<entry\b[\s\S]*?<\/entry>/gi) ?? [];
}
