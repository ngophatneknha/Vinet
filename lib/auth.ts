import {getUser} from '@netlify/identity';
export async function getAppUser(){
 const user=await getUser();
 if(!user?.id||!user.email)return null;
 return {userId:user.id,email:user.email.toLowerCase(),displayName:user.name||user.email,fullName:user.name||null};
}
export const signInPath=(returnTo='/studio')=>'/login?return_to='+encodeURIComponent(returnTo.startsWith('/')&&!returnTo.startsWith('//')?returnTo:'/studio');
