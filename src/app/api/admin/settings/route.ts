import { NextResponse } from "next/server";
import { z } from "zod";
import type { RowDataPacket } from "mysql2";
import { authorize } from "@/lib/authorization";
import { writeAuditLog } from "@/lib/audit";
import { execute, queryRows } from "@/lib/db";
import { env } from "@/lib/env";

const schema=z.object({
 club:z.object({name:z.string().trim().min(2).max(160),phone:z.string().trim().max(30),address:z.string().trim().max(500)}),
 auth:z.object({admin2fa:z.enum(["optional","required"]),sessionDays:z.number().int().min(1).max(90)}),
 otp:z.object({ttlMinutes:z.number().int().min(2).max(30),cooldownSeconds:z.number().int().min(10).max(600),hourlyLimit:z.number().int().min(1).max(30),ipHourlyLimit:z.number().int().min(1).max(100),maxAttempts:z.number().int().min(1).max(10)}),
 registration:z.object({holdMinutes:z.number().int().min(5).max(120),correctionHours:z.number().int().min(1).max(168),waitlistOfferMinutes:z.number().int().min(5).max(1440)}),
 payment:z.object({cash:z.boolean(),pos:z.boolean(),receipt:z.boolean(),partial:z.boolean()}),
 notification:z.object({inApp:z.boolean(),email:z.boolean(),sms:z.enum(["disabled","optional","required"])})
});
type SettingRow=RowDataPacket&{key:string;value:unknown};
function parse(value:unknown){try{return typeof value==='string'?JSON.parse(value):value}catch{return null}}
export async function GET(){const auth=await authorize("settings.manage");if(auth.response)return auth.response;const rows=await queryRows<SettingRow[]>(`SELECT \`key\`,value FROM app_settings WHERE \`key\` IN ('club.profile','auth.settings','payment.settings','notification.settings','registration.settings','otp.settings')`);const map=Object.fromEntries(rows.map(r=>[r.key,parse(r.value)]));return NextResponse.json({item:{
 club:map['club.profile']||{name:'کافه گیم ستارخان',phone:'',address:''},
 auth:{admin2fa:map['auth.settings']?.admin2fa==='required'?'required':'optional',sessionDays:Number(map['auth.settings']?.sessionDays||env.sessionDays)},
 otp:{ttlMinutes:Number(map['otp.settings']?.ttlMinutes||env.smsOtpTtlMinutes),cooldownSeconds:Number(map['otp.settings']?.cooldownSeconds||env.smsOtpCooldownSeconds),hourlyLimit:Number(map['otp.settings']?.hourlyLimit||env.smsOtpHourlyLimit),ipHourlyLimit:Number(map['otp.settings']?.ipHourlyLimit||env.smsOtpIpHourlyLimit),maxAttempts:Number(map['otp.settings']?.maxAttempts||env.smsOtpMaxAttempts)},
 registration:{holdMinutes:Number(map['registration.settings']?.holdMinutes||15),correctionHours:Number(map['registration.settings']?.correctionHours||24),waitlistOfferMinutes:Number(map['registration.settings']?.waitlistOfferMinutes||30)},
 payment:{cash:map['payment.settings']?.cash!==false,pos:map['payment.settings']?.pos!==false,receipt:map['payment.settings']?.receipt!==false,partial:map['payment.settings']?.partial===true},
 notification:{inApp:map['notification.settings']?.inApp!==false,email:map['notification.settings']?.email===true,sms:['optional','required'].includes(map['notification.settings']?.sms)?map['notification.settings'].sms:'disabled'}
}})}
export async function PUT(request:Request){const auth=await authorize("settings.manage");if(auth.response)return auth.response;try{const input=schema.parse(await request.json());const settings:Array<[string,unknown,number]>=[["club.profile",input.club,1],["auth.settings",{password:true,sms:true,google:false,...input.auth},0],["otp.settings",input.otp,0],["registration.settings",input.registration,0],["payment.settings",{provider:"manual_transfer",...input.payment},0],["notification.settings",input.notification,0]];for(const[key,value,isPublic]of settings)await execute(`INSERT INTO app_settings(\`key\`,value,is_public,updated_at) VALUES(?,?,?,NOW()) ON DUPLICATE KEY UPDATE value=VALUES(value),is_public=VALUES(is_public),updated_at=NOW()`,[key,JSON.stringify(value),isPublic]);await writeAuditLog({actorUserId:auth.user.id,action:"settings.updated",entityType:"app_settings",entityId:"main",newData:input,request});return NextResponse.json({ok:true,item:input});}catch(error){if(error instanceof z.ZodError)return NextResponse.json({message:"تنظیمات واردشده معتبر نیست.",errors:error.issues},{status:422});console.error(error);return NextResponse.json({message:"ذخیره تنظیمات انجام نشد."},{status:500});}}
