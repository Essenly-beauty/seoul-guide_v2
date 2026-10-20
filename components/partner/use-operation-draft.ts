'use client';
import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {usePartner,type PartnerDraftRecord} from './partner-provider';
import {failedReloadState,type SaveState} from './partner-form';
/** Keeps new operation forms in the existing account-owned draft lifecycle. */
export function useOperationDraft<T extends {values:unknown;updatedAt:string}>(key:string,initial:T) {
  const {drafts,snapshot}=usePartner();const [fallback]=useState<PartnerDraftRecord<T>>(()=>({token:Symbol(key),draft:initial,baseline:initial,state:{kind:'idle'}}));
  const record=useSyncExternalStore(drafts.subscribe,()=>drafts.read<T>(key)??fallback,()=>fallback);const busy=useRef(false);
  const dirty=JSON.stringify(record.draft.values)!==JSON.stringify(record.baseline.values);const locked=['pending','unconfirmed','committed-stale','reloading'].includes(record.state.kind);
  const serialized=JSON.stringify(initial);
  useEffect(()=>{drafts.setActive(key);if(!drafts.read(key))drafts.write(key,fallback);return()=>drafts.setActive(null,key);},[drafts,key,fallback]);
  useEffect(()=>{const current=drafts.read<T>(key);if(!current||['pending','unconfirmed','reloading'].includes(current.state.kind))return;const value=JSON.parse(serialized)as T;if(JSON.stringify(current.baseline)===serialized)return;if(JSON.stringify(current.draft.values)===JSON.stringify(current.baseline.values))drafts.write(key,{...current,draft:value,baseline:value});else if(JSON.stringify(current.baseline.values)===JSON.stringify(value.values))drafts.write(key,{...current,baseline:value,draft:{...current.draft,updatedAt:value.updatedAt}});},[serialized,drafts,key]);
  const setDraft=(value:T)=>{if(!locked)drafts.write(key,{...record,draft:value,state:{kind:'idle'}});};
  const run=async(operation:()=>Promise<T>,recovery=false)=>{if(busy.current||(!recovery&&(snapshot?.readOnly||locked)))return;busy.current=true;drafts.write(key,{...record,state:{kind:recovery?'reloading':'pending'}});try{const value=await operation();drafts.complete(key,record.token,{...record,draft:value,baseline:value,state:{kind:recovery?'idle':'saved'}});}catch(reason){const code=reason instanceof Error?reason.message:'';let state:SaveState;if(['BOOKING_CONFLICT','PARTNER_CONFLICT','PROFILE_CONFLICT'].includes(code))state={kind:'conflict',message:'다른 곳에서 정보가 변경됐습니다. 입력은 유지되며, 최신 정보를 확인한 뒤 다시 저장해 주세요.'};else if(['INVALID_REQUEST','INVALID_COMMAND','PARTNER_READ_ONLY','PARTNER_FORBIDDEN'].includes(code))state={kind:'error',message:'저장하지 못했습니다. 입력값과 수정 권한을 확인해 주세요.'};else state=recovery?failedReloadState(record.state,'최신 정보를 조회하지 못했습니다. 입력은 유지됩니다.'):{kind:'unconfirmed'};drafts.complete(key,record.token,{...record,state});}finally{busy.current=false;}};
  return {...record,dirty,locked,setDraft,commit:(operation:()=>Promise<T>)=>run(operation),recover:(operation:()=>Promise<T>)=>run(operation,true)};
}
