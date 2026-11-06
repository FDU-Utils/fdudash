// Serialize campus cookie mutations, including authentication and logout.
export async function acquireSession(session) {
 const previous=session.pending||Promise.resolve();
 let release;
 session.pending=new Promise(resolve=>{release=resolve;});
 await previous;
 return release;
}
