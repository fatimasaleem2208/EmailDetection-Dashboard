/** Local, static-only inspection. Does not execute, render, decompress or upload content. */
export type Finding = { severity: "high" | "medium" | "info"; title: string; detail: string };
export type AttachmentReport = {
  name: string; size: number; sha256: string; detectedType: string;
  findings: Finding[]; status: "review" | "caution" | "no-obvious-flags";
};
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const highRisk = new Set(["exe", "scr", "bat", "cmd", "com", "ps1", "vbs", "vbe", "js", "jse", "wsf", "wsh", "hta", "msi", "msp", "lnk", "jar", "reg", "iso", "img", "app", "dmg", "sh"]);
const macroRisk = new Set(["docm", "xlsm", "pptm", "dotm", "xltm", "potm"]);
const containerExt = new Set(["zip", "7z", "rar", "tar", "gz", "iso", "img"]);
const docExt = new Set(["docx", "xlsx", "pptx", "odt", "ods", "odp"]);
const extensionOf = (name: string) => name.toLowerCase().split(".").pop() || "";
const headIs = (bytes: Uint8Array, signature: number[]) => signature.every((part, i) => bytes[i] === part);
const textPrefix = (bytes: Uint8Array, length: number) => new TextDecoder("ascii").decode(bytes.subarray(0, length));
function signatureType(bytes: Uint8Array): string {
  if (headIs(bytes,[0x4d,0x5a])) return "Windows executable (MZ)";
  if (headIs(bytes,[0x25,0x50,0x44,0x46,0x2d])) return "PDF";
  if (headIs(bytes,[0x50,0x4b,0x03,0x04]) || headIs(bytes,[0x50,0x4b,0x05,0x06])) return "ZIP-based container";
  if (headIs(bytes,[0xd0,0xcf,0x11,0xe0,0xa1,0xb1,0x1a,0xe1])) return "Legacy Office/OLE container";
  if (headIs(bytes,[0x89,0x50,0x4e,0x47])) return "PNG image";
  if (headIs(bytes,[0xff,0xd8,0xff])) return "JPEG image";
  if (textPrefix(bytes,6).startsWith("GIF8")) return "GIF image";
  if (headIs(bytes,[0x52,0x61,0x72,0x21,0x1a,0x07])) return "RAR archive";
  if (headIs(bytes,[0x37,0x7a,0xbc,0xaf,0x27,0x1c])) return "7z archive";
  if (headIs(bytes,[0x1f,0x8b])) return "GZIP stream";
  return "Unrecognized signature";
}
/** Reads ZIP central directory *filenames only*. Never decompresses archive entries. */
function zipEntryNames(bytes: Uint8Array): { names: string[]; truncated: boolean } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0,bytes.length - 65557); i--) {
    if (view.getUint32(i,true) === 0x06054b50) { end = i; break; }
  }
  if (end < 0) return { names: [], truncated: true };
  const entries = view.getUint16(end+10,true), offset = view.getUint32(end+16,true);
  const names: string[] = [];
  let i = offset;
  const limit = Math.min(entries, 1000);
  for (let n=0; n<limit; n++) {
    if (i + 46 > bytes.length || view.getUint32(i,true) !== 0x02014b50) return {names,truncated:true};
    const nameLen=view.getUint16(i+28,true), extraLen=view.getUint16(i+30,true), commentLen=view.getUint16(i+32,true);
    if (i+46+nameLen+extraLen+commentLen>bytes.length) return {names,truncated:true};
    names.push(new TextDecoder().decode(bytes.subarray(i+46,i+46+nameLen)));
    i += 46+nameLen+extraLen+commentLen;
  }
  return {names,truncated: entries>limit};
}
function hex(bytes: Uint8Array): string { return [...bytes].map(x=>x.toString(16).padStart(2,"0")).join(""); }
export async function inspectAttachment(file: File): Promise<AttachmentReport> {
  if (file.size > MAX_ATTACHMENT_BYTES) throw new Error("File exceeds the 10 MB inspection limit. No data was processed.");
  if (!file.size) throw new Error("This file is empty.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const hash = await crypto.subtle.digest("SHA-256",bytes);
  const findings: Finding[]=[];
  const add=(severity: Finding["severity"],title:string,detail:string)=>findings.push({severity,title,detail});
  const name=file.name, ext=extensionOf(name), signature=signatureType(bytes);
  const parts=name.toLowerCase().split(".");
  if (highRisk.has(ext)) add("high","Executable or script extension",`The .${ext} extension can launch executable content. Do not run an unexpected attachment.`);
  if (macroRisk.has(ext)) add("high","Macro-enabled Office document",`The .${ext} format can contain active macros. Treat unexpected files with caution.`);
  if (parts.length>=3 && (highRisk.has(ext)||macroRisk.has(ext))) add("high","Double-extension disguise",`A filename ending in .${parts[parts.length-2]}.${ext} can disguise its true file type.`);
  if (/\u202e|[\u202a-\u202d\u2066-\u2069]/u.test(name)) add("high","Bidirectional filename characters","Filename includes Unicode direction controls that can obscure the real extension.");
  if (signature === "Windows executable (MZ)" && !["exe","dll","scr","com"].includes(ext)) add("high","Executable signature mismatch","File starts with an MZ executable signature despite its displayed extension.");
  if (ext === "pdf" && signature !== "PDF") add("high","PDF extension/signature mismatch","This file is named .pdf but does not start with a standard PDF header.");
  if ([...docExt,"zip"].includes(ext) && signature !== "ZIP-based container") add("medium","Archive/document signature mismatch","Modern Office formats and ZIP archives are normally ZIP-based, but this file's header is different.");
  if (["png","jpg","jpeg","gif"].includes(ext) && !["PNG image","JPEG image","GIF image"].includes(signature)) add("medium","Image signature mismatch","The displayed image extension does not match a recognized image signature.");
  if (containerExt.has(ext)) add("medium","Archive/container attachment","Compressed or disk-image attachments can hide additional files. Inspect contents separately in a trusted environment.");
  if (signature === "ZIP-based container") {
    const {names,truncated}=zipEntryNames(bytes);
    if (truncated) add("medium","Archive metadata incomplete","This scanner could not fully read the ZIP entry list (or its size exceeded the inspection limit). Archive content remains unverified.");
    const flagged=names.filter(n=>highRisk.has(extensionOf(n))||macroRisk.has(extensionOf(n))).slice(0,5);
    if (flagged.length) add("high","Risky file names inside ZIP",`ZIP metadata lists potentially active files: ${flagged.join(", ").slice(0,240)}. Entry contents were not opened or scanned.`);
    if (names.length) add("info","ZIP entries listed",`Inspected ${names.length} ZIP filename(s) from archive metadata only; contents were not decompressed.`);
  }
  if (!findings.some(f=>f.severity==="high" || f.severity==="medium")) add("info","No obvious static red flags","No obvious high-risk filename or signature mismatch was detected. This does NOT mean the file is malware-free.");
  const status=findings.some(f=>f.severity==="high")?"review":findings.some(f=>f.severity==="medium")?"caution":"no-obvious-flags";
  return {name,size:file.size,sha256:hex(new Uint8Array(hash)),detectedType:signature,findings,status};
}
