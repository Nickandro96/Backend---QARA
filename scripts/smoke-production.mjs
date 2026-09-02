const backend=(process.env.SMOKE_BACKEND_URL||"").replace(/\/$/,"");
const frontend=(process.env.SMOKE_FRONTEND_URL||"").replace(/\/$/,"");
if(!backend||!frontend)throw new Error("SMOKE_BACKEND_URL and SMOKE_FRONTEND_URL are required");
const assertOk=async(response,label)=>{if(!response.ok)throw new Error(`${label} failed (${response.status}): ${await response.text()}`);return response;};
await assertOk(await fetch(frontend),"frontend");
const healthInput=encodeURIComponent(JSON.stringify({json:{timestamp:Date.now()}}));
await assertOk(await fetch(`${backend}/trpc/system.health?input=${healthInput}`),"backend health");
const email=process.env.SMOKE_EMAIL;const password=process.env.SMOKE_PASSWORD;
if(email&&password){
 const login=await assertOk(await fetch(`${backend}/trpc/system.login`,{method:"POST",headers:{"content-type":"application/json","x-trpc-source":"smoke"},body:JSON.stringify({json:{email,password}})}),"authenticated login");
 const cookie=login.headers.get("set-cookie")?.split(";")[0];if(!cookie)throw new Error("authenticated login returned no session cookie");
 await assertOk(await fetch(`${backend}/trpc/intelligence.access`,{headers:{cookie,"x-trpc-source":"smoke"}}),"intelligence access");
 console.info("Production smoke passed: frontend, backend health and authenticated intelligence access.");
}else console.info("Public smoke passed. Set SMOKE_EMAIL and SMOKE_PASSWORD to include authenticated intelligence access.");
