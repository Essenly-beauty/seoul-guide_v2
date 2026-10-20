'use client';
import {useEffect,useState} from 'react';
import {useDialogFocus} from '@/components/ui/use-dialog-focus';
/** At the dashboard breakpoint, the detail sidebar is a modal sheet. */
export function useDetailSheet(open:boolean,onClose:()=>void,covered=false){
  const [compact,setCompact]=useState(false);
  useEffect(()=>{const media=window.matchMedia('(max-width:1160px)');const update=()=>setCompact(media.matches);update();media.addEventListener('change',update);return()=>media.removeEventListener('change',update);},[]);
  const modal=open&&compact&&!covered;const ref=useDialogFocus<HTMLElement>(modal,onClose);
  return {ref,modal};
}
