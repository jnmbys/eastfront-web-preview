import {passwordHash} from './access.mjs';
let secret='';for await(const chunk of process.stdin){secret+=chunk;if(secret.length>258)throw Error('Password too long');}secret=secret.trimEnd();if(secret.length<20)throw Error('Use a unique access phrase of at least 20 characters');console.log(passwordHash(secret));
