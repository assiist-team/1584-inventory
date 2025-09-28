const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/Projects-CJJ4GWd8.js","assets/vendor-Gm9i_4Ku.js","assets/router-Bad1IJif.js","assets/inventoryService-CSqmAljY.js","assets/firebase-DTZupgGV.js","assets/dateUtils-BvsVwtCK.js","assets/BudgetProgress-0-nw1J_b.js","assets/ui-DKDhksGx.js","assets/ItemDetail-BM_5545j.js","assets/imageService-De3eSBgy.js","assets/ImagePreview-7Z3AOnud.js","assets/ProjectDetail-DpcdaZ5w.js","assets/AddItem-Cc4NBOc0.js","assets/transactionSources-Bmq7Rv82.js","assets/EditItem-Di6yNp5W.js","assets/AddTransaction-CMB-L-Es.js","assets/ImageUpload-CjwkSEun.js","assets/EditTransaction-IpCmw-_l.js","assets/TransactionDetail-Cybsxcqq.js"])))=>i.map(i=>d[i]);
var lt=t=>{throw TypeError(t)};var ze=(t,e,n)=>e.has(t)||lt("Cannot "+n);var a=(t,e,n)=>(ze(t,e,"read from private field"),n?n.call(t):e.get(t)),g=(t,e,n)=>e.has(t)?lt("Cannot add the same private member more than once"):e instanceof WeakSet?e.add(t):e.set(t,n),f=(t,e,n,s)=>(ze(t,e,"write to private field"),s?s.call(t,n):e.set(t,n),n),E=(t,e,n)=>(ze(t,e,"access private method"),n);var Ee=(t,e,n,s)=>({set _(r){f(t,e,r,n)},get _(){return a(t,e,s)}});import{r as b,a as bn,b as In}from"./vendor-Gm9i_4Ku.js";import{L as Tn,O as An,R as xn,a as K,B as Sn}from"./router-Bad1IJif.js";import{c as de,L as Pn,I as Cn,A as En,X as On,C as jn,a as Fn}from"./ui-DKDhksGx.js";import{r as Fe,_ as Re,C as De,a as qe,E as Nt,o as Rn,F as Ut,L as Dn,g as Qt,i as _n,b as kn,v as Mn,c as dt,d as qn,e as Ln,f as Nn,h as Un,j as Qn,k as $n,l as Kn,s as zn,T as Bn}from"./firebase-DTZupgGV.js";(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const r of document.querySelectorAll('link[rel="modulepreload"]'))s(r);new MutationObserver(r=>{for(const i of r)if(i.type==="childList")for(const o of i.addedNodes)o.tagName==="LINK"&&o.rel==="modulepreload"&&s(o)}).observe(document,{childList:!0,subtree:!0});function n(r){const i={};return r.integrity&&(i.integrity=r.integrity),r.referrerPolicy&&(i.referrerPolicy=r.referrerPolicy),r.crossOrigin==="use-credentials"?i.credentials="include":r.crossOrigin==="anonymous"?i.credentials="omit":i.credentials="same-origin",i}function s(r){if(r.ep)return;r.ep=!0;const i=n(r);fetch(r.href,i)}})();var $t={exports:{}},Le={};/**
 * @license React
 * react-jsx-runtime.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */var Gn=b,Vn=Symbol.for("react.element"),Hn=Symbol.for("react.fragment"),Wn=Object.prototype.hasOwnProperty,Yn=Gn.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentOwner,Jn={key:!0,ref:!0,__self:!0,__source:!0};function Kt(t,e,n){var s,r={},i=null,o=null;n!==void 0&&(i=""+n),e.key!==void 0&&(i=""+e.key),e.ref!==void 0&&(o=e.ref);for(s in e)Wn.call(e,s)&&!Jn.hasOwnProperty(s)&&(r[s]=e[s]);if(t&&t.defaultProps)for(s in e=t.defaultProps,e)r[s]===void 0&&(r[s]=e[s]);return{$$typeof:Vn,type:t,key:i,ref:o,props:r,_owner:Yn.current}}Le.Fragment=Hn;Le.jsx=Kt;Le.jsxs=Kt;$t.exports=Le;var d=$t.exports,We={},ht=bn;We.createRoot=ht.createRoot,We.hydrateRoot=ht.hydrateRoot;var Ne=class{constructor(){this.listeners=new Set,this.subscribe=this.subscribe.bind(this)}subscribe(t){return this.listeners.add(t),this.onSubscribe(),()=>{this.listeners.delete(t),this.onUnsubscribe()}}hasListeners(){return this.listeners.size>0}onSubscribe(){}onUnsubscribe(){}},Xn={setTimeout:(t,e)=>setTimeout(t,e),clearTimeout:t=>clearTimeout(t),setInterval:(t,e)=>setInterval(t,e),clearInterval:t=>clearInterval(t)},V,nt,jt,Zn=(jt=class{constructor(){g(this,V,Xn);g(this,nt,!1)}setTimeoutProvider(t){f(this,V,t)}setTimeout(t,e){return a(this,V).setTimeout(t,e)}clearTimeout(t){a(this,V).clearTimeout(t)}setInterval(t,e){return a(this,V).setInterval(t,e)}clearInterval(t){a(this,V).clearInterval(t)}},V=new WeakMap,nt=new WeakMap,jt),Ye=new Zn;function es(t){setTimeout(t,0)}var Ue=typeof window>"u"||"Deno"in globalThis;function q(){}function ts(t,e){return typeof t=="function"?t(e):t}function ns(t){return typeof t=="number"&&t>=0&&t!==1/0}function ss(t,e){return Math.max(t+(e||0)-Date.now(),0)}function Je(t,e){return typeof t=="function"?t(e):t}function rs(t,e){return typeof t=="function"?t(e):t}function ft(t,e){const{type:n="all",exact:s,fetchStatus:r,predicate:i,queryKey:o,stale:c}=t;if(o){if(s){if(e.queryHash!==st(o,e.options))return!1}else if(!Ae(e.queryKey,o))return!1}if(n!=="all"){const u=e.isActive();if(n==="active"&&!u||n==="inactive"&&u)return!1}return!(typeof c=="boolean"&&e.isStale()!==c||r&&r!==e.state.fetchStatus||i&&!i(e))}function pt(t,e){const{exact:n,status:s,predicate:r,mutationKey:i}=t;if(i){if(!e.options.mutationKey)return!1;if(n){if(Te(e.options.mutationKey)!==Te(i))return!1}else if(!Ae(e.options.mutationKey,i))return!1}return!(s&&e.state.status!==s||r&&!r(e))}function st(t,e){return((e==null?void 0:e.queryKeyHashFn)||Te)(t)}function Te(t){return JSON.stringify(t,(e,n)=>Xe(n)?Object.keys(n).sort().reduce((s,r)=>(s[r]=n[r],s),{}):n)}function Ae(t,e){return t===e?!0:typeof t!=typeof e?!1:t&&e&&typeof t=="object"&&typeof e=="object"?Object.keys(e).every(n=>Ae(t[n],e[n])):!1}var is=Object.prototype.hasOwnProperty;function zt(t,e){if(t===e)return t;const n=mt(t)&&mt(e);if(!n&&!(Xe(t)&&Xe(e)))return e;const r=(n?t:Object.keys(t)).length,i=n?e:Object.keys(e),o=i.length,c=n?new Array(o):{};let u=0;for(let l=0;l<o;l++){const y=n?l:i[l],h=t[y],m=e[y];if(h===m){c[y]=h,(n?l<r:is.call(t,y))&&u++;continue}if(h===null||m===null||typeof h!="object"||typeof m!="object"){c[y]=m;continue}const w=zt(h,m);c[y]=w,w===h&&u++}return r===o&&u===r?t:c}function mt(t){return Array.isArray(t)&&t.length===Object.keys(t).length}function Xe(t){if(!yt(t))return!1;const e=t.constructor;if(e===void 0)return!0;const n=e.prototype;return!(!yt(n)||!n.hasOwnProperty("isPrototypeOf")||Object.getPrototypeOf(t)!==Object.prototype)}function yt(t){return Object.prototype.toString.call(t)==="[object Object]"}function as(t){return new Promise(e=>{Ye.setTimeout(e,t)})}function os(t,e,n){return typeof n.structuralSharing=="function"?n.structuralSharing(t,e):n.structuralSharing!==!1?zt(t,e):e}function cs(t,e,n=0){const s=[...t,e];return n&&s.length>n?s.slice(1):s}function us(t,e,n=0){const s=[e,...t];return n&&s.length>n?s.slice(0,-1):s}var rt=Symbol();function Bt(t,e){return!t.queryFn&&(e!=null&&e.initialPromise)?()=>e.initialPromise:!t.queryFn||t.queryFn===rt?()=>Promise.reject(new Error(`Missing queryFn: '${t.queryHash}'`)):t.queryFn}var se,H,he,Ft,ls=(Ft=class extends Ne{constructor(){super();g(this,se);g(this,H);g(this,he);f(this,he,e=>{if(!Ue&&window.addEventListener){const n=()=>e();return window.addEventListener("visibilitychange",n,!1),()=>{window.removeEventListener("visibilitychange",n)}}})}onSubscribe(){a(this,H)||this.setEventListener(a(this,he))}onUnsubscribe(){var e;this.hasListeners()||((e=a(this,H))==null||e.call(this),f(this,H,void 0))}setEventListener(e){var n;f(this,he,e),(n=a(this,H))==null||n.call(this),f(this,H,e(s=>{typeof s=="boolean"?this.setFocused(s):this.onFocus()}))}setFocused(e){a(this,se)!==e&&(f(this,se,e),this.onFocus())}onFocus(){const e=this.isFocused();this.listeners.forEach(n=>{n(e)})}isFocused(){var e;return typeof a(this,se)=="boolean"?a(this,se):((e=globalThis.document)==null?void 0:e.visibilityState)!=="hidden"}},se=new WeakMap,H=new WeakMap,he=new WeakMap,Ft),Gt=new ls;function ds(){let t,e;const n=new Promise((r,i)=>{t=r,e=i});n.status="pending",n.catch(()=>{});function s(r){Object.assign(n,r),delete n.resolve,delete n.reject}return n.resolve=r=>{s({status:"fulfilled",value:r}),t(r)},n.reject=r=>{s({status:"rejected",reason:r}),e(r)},n}var hs=es;function fs(){let t=[],e=0,n=c=>{c()},s=c=>{c()},r=hs;const i=c=>{e?t.push(c):r(()=>{n(c)})},o=()=>{const c=t;t=[],c.length&&r(()=>{s(()=>{c.forEach(u=>{n(u)})})})};return{batch:c=>{let u;e++;try{u=c()}finally{e--,e||o()}return u},batchCalls:c=>(...u)=>{i(()=>{c(...u)})},schedule:i,setNotifyFunction:c=>{n=c},setBatchNotifyFunction:c=>{s=c},setScheduler:c=>{r=c}}}var F=fs(),fe,W,pe,Rt,ps=(Rt=class extends Ne{constructor(){super();g(this,fe,!0);g(this,W);g(this,pe);f(this,pe,e=>{if(!Ue&&window.addEventListener){const n=()=>e(!0),s=()=>e(!1);return window.addEventListener("online",n,!1),window.addEventListener("offline",s,!1),()=>{window.removeEventListener("online",n),window.removeEventListener("offline",s)}}})}onSubscribe(){a(this,W)||this.setEventListener(a(this,pe))}onUnsubscribe(){var e;this.hasListeners()||((e=a(this,W))==null||e.call(this),f(this,W,void 0))}setEventListener(e){var n;f(this,pe,e),(n=a(this,W))==null||n.call(this),f(this,W,e(this.setOnline.bind(this)))}setOnline(e){a(this,fe)!==e&&(f(this,fe,e),this.listeners.forEach(s=>{s(e)}))}isOnline(){return a(this,fe)}},fe=new WeakMap,W=new WeakMap,pe=new WeakMap,Rt),_e=new ps;function ms(t){return Math.min(1e3*2**t,3e4)}function Vt(t){return(t??"online")==="online"?_e.isOnline():!0}var Ze=class extends Error{constructor(t){super("CancelledError"),this.revert=t==null?void 0:t.revert,this.silent=t==null?void 0:t.silent}};function Ht(t){let e=!1,n=0,s;const r=ds(),i=()=>r.status!=="pending",o=v=>{var A;if(!i()){const x=new Ze(v);m(x),(A=t.onCancel)==null||A.call(t,x)}},c=()=>{e=!0},u=()=>{e=!1},l=()=>Gt.isFocused()&&(t.networkMode==="always"||_e.isOnline())&&t.canRun(),y=()=>Vt(t.networkMode)&&t.canRun(),h=v=>{i()||(s==null||s(),r.resolve(v))},m=v=>{i()||(s==null||s(),r.reject(v))},w=()=>new Promise(v=>{var A;s=x=>{(i()||l())&&v(x)},(A=t.onPause)==null||A.call(t)}).then(()=>{var v;s=void 0,i()||(v=t.onContinue)==null||v.call(t)}),C=()=>{if(i())return;let v;const A=n===0?t.initialPromise:void 0;try{v=A??t.fn()}catch(x){v=Promise.reject(x)}Promise.resolve(v).then(h).catch(x=>{var M;if(i())return;const R=t.retry??(Ue?0:3),T=t.retryDelay??ms,p=typeof T=="function"?T(n,x):T,O=R===!0||typeof R=="number"&&n<R||typeof R=="function"&&R(n,x);if(e||!O){m(x);return}n++,(M=t.onFail)==null||M.call(t,n,x),as(p).then(()=>l()?void 0:w()).then(()=>{e?m(x):C()})})};return{promise:r,status:()=>r.status,cancel:o,continue:()=>(s==null||s(),r),cancelRetry:c,continueRetry:u,canStart:y,start:()=>(y()?C():w().then(C),r)}}var re,Dt,Wt=(Dt=class{constructor(){g(this,re)}destroy(){this.clearGcTimeout()}scheduleGc(){this.clearGcTimeout(),ns(this.gcTime)&&f(this,re,Ye.setTimeout(()=>{this.optionalRemove()},this.gcTime))}updateGcTime(t){this.gcTime=Math.max(this.gcTime||0,t??(Ue?1/0:5*60*1e3))}clearGcTimeout(){a(this,re)&&(Ye.clearTimeout(a(this,re)),f(this,re,void 0))}},re=new WeakMap,Dt),ie,me,k,ae,P,xe,oe,L,z,_t,ys=(_t=class extends Wt{constructor(e){super();g(this,L);g(this,ie);g(this,me);g(this,k);g(this,ae);g(this,P);g(this,xe);g(this,oe);f(this,oe,!1),f(this,xe,e.defaultOptions),this.setOptions(e.options),this.observers=[],f(this,ae,e.client),f(this,k,a(this,ae).getQueryCache()),this.queryKey=e.queryKey,this.queryHash=e.queryHash,f(this,ie,gt(this.options)),this.state=e.state??a(this,ie),this.scheduleGc()}get meta(){return this.options.meta}get promise(){var e;return(e=a(this,P))==null?void 0:e.promise}setOptions(e){if(this.options={...a(this,xe),...e},this.updateGcTime(this.options.gcTime),this.state&&this.state.data===void 0){const n=gt(this.options);n.data!==void 0&&(this.setData(n.data,{updatedAt:n.dataUpdatedAt,manual:!0}),f(this,ie,n))}}optionalRemove(){!this.observers.length&&this.state.fetchStatus==="idle"&&a(this,k).remove(this)}setData(e,n){const s=os(this.state.data,e,this.options);return E(this,L,z).call(this,{data:s,type:"success",dataUpdatedAt:n==null?void 0:n.updatedAt,manual:n==null?void 0:n.manual}),s}setState(e,n){E(this,L,z).call(this,{type:"setState",state:e,setStateOptions:n})}cancel(e){var s,r;const n=(s=a(this,P))==null?void 0:s.promise;return(r=a(this,P))==null||r.cancel(e),n?n.then(q).catch(q):Promise.resolve()}destroy(){super.destroy(),this.cancel({silent:!0})}reset(){this.destroy(),this.setState(a(this,ie))}isActive(){return this.observers.some(e=>rs(e.options.enabled,this)!==!1)}isDisabled(){return this.getObserversCount()>0?!this.isActive():this.options.queryFn===rt||this.state.dataUpdateCount+this.state.errorUpdateCount===0}isStatic(){return this.getObserversCount()>0?this.observers.some(e=>Je(e.options.staleTime,this)==="static"):!1}isStale(){return this.getObserversCount()>0?this.observers.some(e=>e.getCurrentResult().isStale):this.state.data===void 0||this.state.isInvalidated}isStaleByTime(e=0){return this.state.data===void 0?!0:e==="static"?!1:this.state.isInvalidated?!0:!ss(this.state.dataUpdatedAt,e)}onFocus(){var n;const e=this.observers.find(s=>s.shouldFetchOnWindowFocus());e==null||e.refetch({cancelRefetch:!1}),(n=a(this,P))==null||n.continue()}onOnline(){var n;const e=this.observers.find(s=>s.shouldFetchOnReconnect());e==null||e.refetch({cancelRefetch:!1}),(n=a(this,P))==null||n.continue()}addObserver(e){this.observers.includes(e)||(this.observers.push(e),this.clearGcTimeout(),a(this,k).notify({type:"observerAdded",query:this,observer:e}))}removeObserver(e){this.observers.includes(e)&&(this.observers=this.observers.filter(n=>n!==e),this.observers.length||(a(this,P)&&(a(this,oe)?a(this,P).cancel({revert:!0}):a(this,P).cancelRetry()),this.scheduleGc()),a(this,k).notify({type:"observerRemoved",query:this,observer:e}))}getObserversCount(){return this.observers.length}invalidate(){this.state.isInvalidated||E(this,L,z).call(this,{type:"invalidate"})}async fetch(e,n){var u,l,y,h,m,w,C,v,A,x,R,T;if(this.state.fetchStatus!=="idle"&&((u=a(this,P))==null?void 0:u.status())!=="rejected"){if(this.state.data!==void 0&&(n!=null&&n.cancelRefetch))this.cancel({silent:!0});else if(a(this,P))return a(this,P).continueRetry(),a(this,P).promise}if(e&&this.setOptions(e),!this.options.queryFn){const p=this.observers.find(O=>O.options.queryFn);p&&this.setOptions(p.options)}const s=new AbortController,r=p=>{Object.defineProperty(p,"signal",{enumerable:!0,get:()=>(f(this,oe,!0),s.signal)})},i=()=>{const p=Bt(this.options,n),M=(()=>{const ee={client:a(this,ae),queryKey:this.queryKey,meta:this.meta};return r(ee),ee})();return f(this,oe,!1),this.options.persister?this.options.persister(p,M,this):p(M)},c=(()=>{const p={fetchOptions:n,options:this.options,queryKey:this.queryKey,client:a(this,ae),state:this.state,fetchFn:i};return r(p),p})();(l=this.options.behavior)==null||l.onFetch(c,this),f(this,me,this.state),(this.state.fetchStatus==="idle"||this.state.fetchMeta!==((y=c.fetchOptions)==null?void 0:y.meta))&&E(this,L,z).call(this,{type:"fetch",meta:(h=c.fetchOptions)==null?void 0:h.meta}),f(this,P,Ht({initialPromise:n==null?void 0:n.initialPromise,fn:c.fetchFn,onCancel:p=>{p instanceof Ze&&p.revert&&this.setState({...a(this,me),fetchStatus:"idle"}),s.abort()},onFail:(p,O)=>{E(this,L,z).call(this,{type:"failed",failureCount:p,error:O})},onPause:()=>{E(this,L,z).call(this,{type:"pause"})},onContinue:()=>{E(this,L,z).call(this,{type:"continue"})},retry:c.options.retry,retryDelay:c.options.retryDelay,networkMode:c.options.networkMode,canRun:()=>!0}));try{const p=await a(this,P).start();if(p===void 0)throw new Error(`${this.queryHash} data is undefined`);return this.setData(p),(w=(m=a(this,k).config).onSuccess)==null||w.call(m,p,this),(v=(C=a(this,k).config).onSettled)==null||v.call(C,p,this.state.error,this),p}catch(p){if(p instanceof Ze){if(p.silent)return a(this,P).promise;if(p.revert){if(this.state.data===void 0)throw p;return this.state.data}}throw E(this,L,z).call(this,{type:"error",error:p}),(x=(A=a(this,k).config).onError)==null||x.call(A,p,this),(T=(R=a(this,k).config).onSettled)==null||T.call(R,this.state.data,p,this),p}finally{this.scheduleGc()}}},ie=new WeakMap,me=new WeakMap,k=new WeakMap,ae=new WeakMap,P=new WeakMap,xe=new WeakMap,oe=new WeakMap,L=new WeakSet,z=function(e){const n=s=>{switch(e.type){case"failed":return{...s,fetchFailureCount:e.failureCount,fetchFailureReason:e.error};case"pause":return{...s,fetchStatus:"paused"};case"continue":return{...s,fetchStatus:"fetching"};case"fetch":return{...s,...gs(s.data,this.options),fetchMeta:e.meta??null};case"success":const r={...s,data:e.data,dataUpdateCount:s.dataUpdateCount+1,dataUpdatedAt:e.dataUpdatedAt??Date.now(),error:null,isInvalidated:!1,status:"success",...!e.manual&&{fetchStatus:"idle",fetchFailureCount:0,fetchFailureReason:null}};return f(this,me,e.manual?r:void 0),r;case"error":const i=e.error;return{...s,error:i,errorUpdateCount:s.errorUpdateCount+1,errorUpdatedAt:Date.now(),fetchFailureCount:s.fetchFailureCount+1,fetchFailureReason:i,fetchStatus:"idle",status:"error"};case"invalidate":return{...s,isInvalidated:!0};case"setState":return{...s,...e.state}}};this.state=n(this.state),F.batch(()=>{this.observers.forEach(s=>{s.onQueryUpdate()}),a(this,k).notify({query:this,type:"updated",action:e})})},_t);function gs(t,e){return{fetchFailureCount:0,fetchFailureReason:null,fetchStatus:Vt(e.networkMode)?"fetching":"paused",...t===void 0&&{error:null,status:"pending"}}}function gt(t){const e=typeof t.initialData=="function"?t.initialData():t.initialData,n=e!==void 0,s=n?typeof t.initialDataUpdatedAt=="function"?t.initialDataUpdatedAt():t.initialDataUpdatedAt:0;return{data:e,dataUpdateCount:0,dataUpdatedAt:n?s??Date.now():0,error:null,errorUpdateCount:0,errorUpdatedAt:0,fetchFailureCount:0,fetchFailureReason:null,fetchMeta:null,isInvalidated:!1,status:n?"success":"pending",fetchStatus:"idle"}}function wt(t){return{onFetch:(e,n)=>{var y,h,m,w,C;const s=e.options,r=(m=(h=(y=e.fetchOptions)==null?void 0:y.meta)==null?void 0:h.fetchMore)==null?void 0:m.direction,i=((w=e.state.data)==null?void 0:w.pages)||[],o=((C=e.state.data)==null?void 0:C.pageParams)||[];let c={pages:[],pageParams:[]},u=0;const l=async()=>{let v=!1;const A=T=>{Object.defineProperty(T,"signal",{enumerable:!0,get:()=>(e.signal.aborted?v=!0:e.signal.addEventListener("abort",()=>{v=!0}),e.signal)})},x=Bt(e.options,e.fetchOptions),R=async(T,p,O)=>{if(v)return Promise.reject();if(p==null&&T.pages.length)return Promise.resolve(T);const ee=(()=>{const te={client:e.client,queryKey:e.queryKey,pageParam:p,direction:O?"backward":"forward",meta:e.options.meta};return A(te),te})(),Ce=await x(ee),{maxPages:be}=e.options,S=O?us:cs;return{pages:S(T.pages,Ce,be),pageParams:S(T.pageParams,p,be)}};if(r&&i.length){const T=r==="backward",p=T?ws:vt,O={pages:i,pageParams:o},M=p(s,O);c=await R(O,M,T)}else{const T=t??i.length;do{const p=u===0?o[0]??s.initialPageParam:vt(s,c);if(u>0&&p==null)break;c=await R(c,p),u++}while(u<T)}return c};e.options.persister?e.fetchFn=()=>{var v,A;return(A=(v=e.options).persister)==null?void 0:A.call(v,l,{client:e.client,queryKey:e.queryKey,meta:e.options.meta,signal:e.signal},n)}:e.fetchFn=l}}}function vt(t,{pages:e,pageParams:n}){const s=e.length-1;return e.length>0?t.getNextPageParam(e[s],e,n[s],n):void 0}function ws(t,{pages:e,pageParams:n}){var s;return e.length>0?(s=t.getPreviousPageParam)==null?void 0:s.call(t,e[0],e,n[0],n):void 0}var Se,U,j,ce,Q,G,kt,vs=(kt=class extends Wt{constructor(e){super();g(this,Q);g(this,Se);g(this,U);g(this,j);g(this,ce);f(this,Se,e.client),this.mutationId=e.mutationId,f(this,j,e.mutationCache),f(this,U,[]),this.state=e.state||bs(),this.setOptions(e.options),this.scheduleGc()}setOptions(e){this.options=e,this.updateGcTime(this.options.gcTime)}get meta(){return this.options.meta}addObserver(e){a(this,U).includes(e)||(a(this,U).push(e),this.clearGcTimeout(),a(this,j).notify({type:"observerAdded",mutation:this,observer:e}))}removeObserver(e){f(this,U,a(this,U).filter(n=>n!==e)),this.scheduleGc(),a(this,j).notify({type:"observerRemoved",mutation:this,observer:e})}optionalRemove(){a(this,U).length||(this.state.status==="pending"?this.scheduleGc():a(this,j).remove(this))}continue(){var e;return((e=a(this,ce))==null?void 0:e.continue())??this.execute(this.state.variables)}async execute(e){var o,c,u,l,y,h,m,w,C,v,A,x,R,T,p,O,M,ee,Ce,be;const n=()=>{E(this,Q,G).call(this,{type:"continue"})},s={client:a(this,Se),meta:this.options.meta,mutationKey:this.options.mutationKey};f(this,ce,Ht({fn:()=>this.options.mutationFn?this.options.mutationFn(e,s):Promise.reject(new Error("No mutationFn found")),onFail:(S,te)=>{E(this,Q,G).call(this,{type:"failed",failureCount:S,error:te})},onPause:()=>{E(this,Q,G).call(this,{type:"pause"})},onContinue:n,retry:this.options.retry??0,retryDelay:this.options.retryDelay,networkMode:this.options.networkMode,canRun:()=>a(this,j).canRun(this)}));const r=this.state.status==="pending",i=!a(this,ce).canStart();try{if(r)n();else{E(this,Q,G).call(this,{type:"pending",variables:e,isPaused:i}),await((c=(o=a(this,j).config).onMutate)==null?void 0:c.call(o,e,this,s));const te=await((l=(u=this.options).onMutate)==null?void 0:l.call(u,e,s));te!==this.state.context&&E(this,Q,G).call(this,{type:"pending",context:te,variables:e,isPaused:i})}const S=await a(this,ce).start();return await((h=(y=a(this,j).config).onSuccess)==null?void 0:h.call(y,S,e,this.state.context,this,s)),await((w=(m=this.options).onSuccess)==null?void 0:w.call(m,S,e,this.state.context,s)),await((v=(C=a(this,j).config).onSettled)==null?void 0:v.call(C,S,null,this.state.variables,this.state.context,this,s)),await((x=(A=this.options).onSettled)==null?void 0:x.call(A,S,null,e,this.state.context,s)),E(this,Q,G).call(this,{type:"success",data:S}),S}catch(S){try{throw await((T=(R=a(this,j).config).onError)==null?void 0:T.call(R,S,e,this.state.context,this,s)),await((O=(p=this.options).onError)==null?void 0:O.call(p,S,e,this.state.context,s)),await((ee=(M=a(this,j).config).onSettled)==null?void 0:ee.call(M,void 0,S,this.state.variables,this.state.context,this,s)),await((be=(Ce=this.options).onSettled)==null?void 0:be.call(Ce,void 0,S,e,this.state.context,s)),S}finally{E(this,Q,G).call(this,{type:"error",error:S})}}finally{a(this,j).runNext(this)}}},Se=new WeakMap,U=new WeakMap,j=new WeakMap,ce=new WeakMap,Q=new WeakSet,G=function(e){const n=s=>{switch(e.type){case"failed":return{...s,failureCount:e.failureCount,failureReason:e.error};case"pause":return{...s,isPaused:!0};case"continue":return{...s,isPaused:!1};case"pending":return{...s,context:e.context,data:void 0,failureCount:0,failureReason:null,error:null,isPaused:e.isPaused,status:"pending",variables:e.variables,submittedAt:Date.now()};case"success":return{...s,data:e.data,failureCount:0,failureReason:null,error:null,status:"success",isPaused:!1};case"error":return{...s,data:void 0,error:e.error,failureCount:s.failureCount+1,failureReason:e.error,isPaused:!1,status:"error"}}};this.state=n(this.state),F.batch(()=>{a(this,U).forEach(s=>{s.onMutationUpdate(e)}),a(this,j).notify({mutation:this,type:"updated",action:e})})},kt);function bs(){return{context:void 0,data:void 0,error:null,failureCount:0,failureReason:null,isPaused:!1,status:"idle",variables:void 0,submittedAt:0}}var B,N,Pe,Mt,Is=(Mt=class extends Ne{constructor(e={}){super();g(this,B);g(this,N);g(this,Pe);this.config=e,f(this,B,new Set),f(this,N,new Map),f(this,Pe,0)}build(e,n,s){const r=new vs({client:e,mutationCache:this,mutationId:++Ee(this,Pe)._,options:e.defaultMutationOptions(n),state:s});return this.add(r),r}add(e){a(this,B).add(e);const n=Oe(e);if(typeof n=="string"){const s=a(this,N).get(n);s?s.push(e):a(this,N).set(n,[e])}this.notify({type:"added",mutation:e})}remove(e){if(a(this,B).delete(e)){const n=Oe(e);if(typeof n=="string"){const s=a(this,N).get(n);if(s)if(s.length>1){const r=s.indexOf(e);r!==-1&&s.splice(r,1)}else s[0]===e&&a(this,N).delete(n)}}this.notify({type:"removed",mutation:e})}canRun(e){const n=Oe(e);if(typeof n=="string"){const s=a(this,N).get(n),r=s==null?void 0:s.find(i=>i.state.status==="pending");return!r||r===e}else return!0}runNext(e){var s;const n=Oe(e);if(typeof n=="string"){const r=(s=a(this,N).get(n))==null?void 0:s.find(i=>i!==e&&i.state.isPaused);return(r==null?void 0:r.continue())??Promise.resolve()}else return Promise.resolve()}clear(){F.batch(()=>{a(this,B).forEach(e=>{this.notify({type:"removed",mutation:e})}),a(this,B).clear(),a(this,N).clear()})}getAll(){return Array.from(a(this,B))}find(e){const n={exact:!0,...e};return this.getAll().find(s=>pt(n,s))}findAll(e={}){return this.getAll().filter(n=>pt(e,n))}notify(e){F.batch(()=>{this.listeners.forEach(n=>{n(e)})})}resumePausedMutations(){const e=this.getAll().filter(n=>n.state.isPaused);return F.batch(()=>Promise.all(e.map(n=>n.continue().catch(q))))}},B=new WeakMap,N=new WeakMap,Pe=new WeakMap,Mt);function Oe(t){var e;return(e=t.options.scope)==null?void 0:e.id}var $,qt,Ts=(qt=class extends Ne{constructor(e={}){super();g(this,$);this.config=e,f(this,$,new Map)}build(e,n,s){const r=n.queryKey,i=n.queryHash??st(r,n);let o=this.get(i);return o||(o=new ys({client:e,queryKey:r,queryHash:i,options:e.defaultQueryOptions(n),state:s,defaultOptions:e.getQueryDefaults(r)}),this.add(o)),o}add(e){a(this,$).has(e.queryHash)||(a(this,$).set(e.queryHash,e),this.notify({type:"added",query:e}))}remove(e){const n=a(this,$).get(e.queryHash);n&&(e.destroy(),n===e&&a(this,$).delete(e.queryHash),this.notify({type:"removed",query:e}))}clear(){F.batch(()=>{this.getAll().forEach(e=>{this.remove(e)})})}get(e){return a(this,$).get(e)}getAll(){return[...a(this,$).values()]}find(e){const n={exact:!0,...e};return this.getAll().find(s=>ft(n,s))}findAll(e={}){const n=this.getAll();return Object.keys(e).length>0?n.filter(s=>ft(e,s)):n}notify(e){F.batch(()=>{this.listeners.forEach(n=>{n(e)})})}onFocus(){F.batch(()=>{this.getAll().forEach(e=>{e.onFocus()})})}onOnline(){F.batch(()=>{this.getAll().forEach(e=>{e.onOnline()})})}},$=new WeakMap,qt),I,Y,J,ye,ge,X,we,ve,Lt,As=(Lt=class{constructor(t={}){g(this,I);g(this,Y);g(this,J);g(this,ye);g(this,ge);g(this,X);g(this,we);g(this,ve);f(this,I,t.queryCache||new Ts),f(this,Y,t.mutationCache||new Is),f(this,J,t.defaultOptions||{}),f(this,ye,new Map),f(this,ge,new Map),f(this,X,0)}mount(){Ee(this,X)._++,a(this,X)===1&&(f(this,we,Gt.subscribe(async t=>{t&&(await this.resumePausedMutations(),a(this,I).onFocus())})),f(this,ve,_e.subscribe(async t=>{t&&(await this.resumePausedMutations(),a(this,I).onOnline())})))}unmount(){var t,e;Ee(this,X)._--,a(this,X)===0&&((t=a(this,we))==null||t.call(this),f(this,we,void 0),(e=a(this,ve))==null||e.call(this),f(this,ve,void 0))}isFetching(t){return a(this,I).findAll({...t,fetchStatus:"fetching"}).length}isMutating(t){return a(this,Y).findAll({...t,status:"pending"}).length}getQueryData(t){var n;const e=this.defaultQueryOptions({queryKey:t});return(n=a(this,I).get(e.queryHash))==null?void 0:n.state.data}ensureQueryData(t){const e=this.defaultQueryOptions(t),n=a(this,I).build(this,e),s=n.state.data;return s===void 0?this.fetchQuery(t):(t.revalidateIfStale&&n.isStaleByTime(Je(e.staleTime,n))&&this.prefetchQuery(e),Promise.resolve(s))}getQueriesData(t){return a(this,I).findAll(t).map(({queryKey:e,state:n})=>{const s=n.data;return[e,s]})}setQueryData(t,e,n){const s=this.defaultQueryOptions({queryKey:t}),r=a(this,I).get(s.queryHash),i=r==null?void 0:r.state.data,o=ts(e,i);if(o!==void 0)return a(this,I).build(this,s).setData(o,{...n,manual:!0})}setQueriesData(t,e,n){return F.batch(()=>a(this,I).findAll(t).map(({queryKey:s})=>[s,this.setQueryData(s,e,n)]))}getQueryState(t){var n;const e=this.defaultQueryOptions({queryKey:t});return(n=a(this,I).get(e.queryHash))==null?void 0:n.state}removeQueries(t){const e=a(this,I);F.batch(()=>{e.findAll(t).forEach(n=>{e.remove(n)})})}resetQueries(t,e){const n=a(this,I);return F.batch(()=>(n.findAll(t).forEach(s=>{s.reset()}),this.refetchQueries({type:"active",...t},e)))}cancelQueries(t,e={}){const n={revert:!0,...e},s=F.batch(()=>a(this,I).findAll(t).map(r=>r.cancel(n)));return Promise.all(s).then(q).catch(q)}invalidateQueries(t,e={}){return F.batch(()=>(a(this,I).findAll(t).forEach(n=>{n.invalidate()}),(t==null?void 0:t.refetchType)==="none"?Promise.resolve():this.refetchQueries({...t,type:(t==null?void 0:t.refetchType)??(t==null?void 0:t.type)??"active"},e)))}refetchQueries(t,e={}){const n={...e,cancelRefetch:e.cancelRefetch??!0},s=F.batch(()=>a(this,I).findAll(t).filter(r=>!r.isDisabled()&&!r.isStatic()).map(r=>{let i=r.fetch(void 0,n);return n.throwOnError||(i=i.catch(q)),r.state.fetchStatus==="paused"?Promise.resolve():i}));return Promise.all(s).then(q)}fetchQuery(t){const e=this.defaultQueryOptions(t);e.retry===void 0&&(e.retry=!1);const n=a(this,I).build(this,e);return n.isStaleByTime(Je(e.staleTime,n))?n.fetch(e):Promise.resolve(n.state.data)}prefetchQuery(t){return this.fetchQuery(t).then(q).catch(q)}fetchInfiniteQuery(t){return t.behavior=wt(t.pages),this.fetchQuery(t)}prefetchInfiniteQuery(t){return this.fetchInfiniteQuery(t).then(q).catch(q)}ensureInfiniteQueryData(t){return t.behavior=wt(t.pages),this.ensureQueryData(t)}resumePausedMutations(){return _e.isOnline()?a(this,Y).resumePausedMutations():Promise.resolve()}getQueryCache(){return a(this,I)}getMutationCache(){return a(this,Y)}getDefaultOptions(){return a(this,J)}setDefaultOptions(t){f(this,J,t)}setQueryDefaults(t,e){a(this,ye).set(Te(t),{queryKey:t,defaultOptions:e})}getQueryDefaults(t){const e=[...a(this,ye).values()],n={};return e.forEach(s=>{Ae(t,s.queryKey)&&Object.assign(n,s.defaultOptions)}),n}setMutationDefaults(t,e){a(this,ge).set(Te(t),{mutationKey:t,defaultOptions:e})}getMutationDefaults(t){const e=[...a(this,ge).values()],n={};return e.forEach(s=>{Ae(t,s.mutationKey)&&Object.assign(n,s.defaultOptions)}),n}defaultQueryOptions(t){if(t._defaulted)return t;const e={...a(this,J).queries,...this.getQueryDefaults(t.queryKey),...t,_defaulted:!0};return e.queryHash||(e.queryHash=st(e.queryKey,e)),e.refetchOnReconnect===void 0&&(e.refetchOnReconnect=e.networkMode!=="always"),e.throwOnError===void 0&&(e.throwOnError=!!e.suspense),!e.networkMode&&e.persister&&(e.networkMode="offlineFirst"),e.queryFn===rt&&(e.enabled=!1),e}defaultMutationOptions(t){return t!=null&&t._defaulted?t:{...a(this,J).mutations,...(t==null?void 0:t.mutationKey)&&this.getMutationDefaults(t.mutationKey),...t,_defaulted:!0}}clear(){a(this,I).clear(),a(this,Y).clear()}},I=new WeakMap,Y=new WeakMap,J=new WeakMap,ye=new WeakMap,ge=new WeakMap,X=new WeakMap,we=new WeakMap,ve=new WeakMap,Lt),xs=b.createContext(void 0),Ss=({client:t,children:e})=>(b.useEffect(()=>(t.mount(),()=>{t.unmount()}),[t]),d.jsx(xs.Provider,{value:t,children:e}));const Ps="modulepreload",Cs=function(t){return"/"+t},bt={},Z=function(e,n,s){let r=Promise.resolve();if(n&&n.length>0){document.getElementsByTagName("link");const o=document.querySelector("meta[property=csp-nonce]"),c=(o==null?void 0:o.nonce)||(o==null?void 0:o.getAttribute("nonce"));r=Promise.allSettled(n.map(u=>{if(u=Cs(u),u in bt)return;bt[u]=!0;const l=u.endsWith(".css"),y=l?'[rel="stylesheet"]':"";if(document.querySelector(`link[href="${u}"]${y}`))return;const h=document.createElement("link");if(h.rel=l?"stylesheet":Ps,l||(h.as="script"),h.crossOrigin="",h.href=u,c&&h.setAttribute("nonce",c),document.head.appendChild(h),l)return new Promise((m,w)=>{h.addEventListener("load",m),h.addEventListener("error",()=>w(new Error(`Unable to preload CSS for ${u}`)))})}))}function i(o){const c=new Event("vite:preloadError",{cancelable:!0});if(c.payload=o,window.dispatchEvent(c),!c.defaultPrevented)throw o}return r.then(o=>{for(const c of o||[])c.status==="rejected"&&i(c.reason);return e().catch(i)})};function Es(){return d.jsx("header",{className:"bg-white shadow-sm border-b border-gray-200",children:d.jsx("div",{className:"mx-auto max-w-7xl px-4 sm:px-6 lg:px-8",children:d.jsxs("div",{className:"flex h-16 justify-between items-center",children:[d.jsx("div",{className:"flex items-center",children:d.jsx(Tn,{to:"/",className:"text-xl font-bold text-gray-900",children:"1584 Design Inventory & Transactions"})}),d.jsx("div",{className:"flex items-center space-x-4"})]})})})}function Os({children:t}){return d.jsx("div",{className:"min-h-screen bg-gray-50",children:d.jsxs("div",{className:"flex flex-col",children:[d.jsx(Es,{}),d.jsx("main",{className:"flex-1 py-6",children:d.jsx("div",{className:"mx-auto max-w-7xl px-4 sm:px-6 lg:px-8",children:t||d.jsx(An,{})})})]})})}function js({size:t="md",className:e}){const n={sm:"h-4 w-4",md:"h-8 w-8",lg:"h-12 w-12"};return d.jsx("div",{className:de("flex items-center justify-center",e),children:d.jsx(Pn,{className:de("animate-spin text-primary-600",n[t])})})}const Fs={success:jn,error:On,warning:En,info:Cn},Rs={success:{container:"bg-green-50 border-green-200",icon:"text-green-400",text:"text-green-800",button:"text-green-400 hover:bg-green-100"},error:{container:"bg-red-50 border-red-200",icon:"text-red-400",text:"text-red-800",button:"text-red-400 hover:bg-red-100"},warning:{container:"bg-yellow-50 border-yellow-200",icon:"text-yellow-400",text:"text-yellow-800",button:"text-yellow-400 hover:bg-yellow-100"},info:{container:"bg-blue-50 border-blue-200",icon:"text-blue-400",text:"text-blue-800",button:"text-blue-400 hover:bg-blue-100"}};function Ds({toast:t,onClose:e}){const[n,s]=b.useState(!1),[r,i]=b.useState(!1),o=Fs[t.type],c=Rs[t.type];b.useEffect(()=>{s(!0);const l=t.duration||(t.type==="error"?6e3:4e3),y=setTimeout(()=>{u()},l);return()=>clearTimeout(y)},[t.duration,t.type]);const u=()=>{i(!0),setTimeout(()=>{e(t.id)},300)};return d.jsxs("div",{className:de("flex items-center justify-between p-4 mb-3 border rounded-lg shadow-sm transition-all duration-300 transform",c.container,n&&!r?"translate-x-0 opacity-100":"-translate-x-full opacity-0"),children:[d.jsxs("div",{className:"flex items-center",children:[d.jsx(o,{className:de("h-5 w-5 mr-3 flex-shrink-0",c.icon)}),d.jsx("p",{className:de("text-sm font-medium",c.text),children:t.message})]}),d.jsx("button",{onClick:u,className:de("ml-4 inline-flex rounded-md p-1.5 transition-colors duration-200",c.button),children:d.jsx(Fn,{className:"h-4 w-4"})})]})}const Yt=b.createContext(void 0);function yi(){const t=b.useContext(Yt);if(t===void 0)throw new Error("useToast must be used within a ToastProvider");return t}function _s({children:t}){const[e,n]=b.useState([]),s=()=>Math.random().toString(36).substr(2,9),r=b.useCallback((h,m,w)=>{const C=s(),v={id:C,message:h,type:m,duration:w};return n(A=>[...A,v]),setTimeout(()=>{l(C)},(w||(m==="error"?6e3:4e3))+300),C},[]),i=b.useCallback((h,m)=>r(h,"success",m),[r]),o=b.useCallback((h,m)=>r(h,"error",m),[r]),c=b.useCallback((h,m)=>r(h,"warning",m),[r]),u=b.useCallback((h,m)=>r(h,"info",m),[r]),l=b.useCallback(h=>{n(m=>m.filter(w=>w.id!==h))},[]),y={showToast:r,showSuccess:i,showError:o,showWarning:c,showInfo:u,removeToast:l};return d.jsxs(Yt.Provider,{value:y,children:[t,d.jsx("div",{className:"fixed top-4 right-4 z-50 min-w-96 max-w-sm",children:e.map(h=>d.jsx(Ds,{toast:h,onClose:l},h.id))})]})}const Jt="@firebase/installations",it="0.6.9";/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Xt=1e4,Zt=`w:${it}`,en="FIS_v2",ks="https://firebaseinstallations.googleapis.com/v1",Ms=60*60*1e3,qs="installations",Ls="Installations";/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Ns={"missing-app-config-values":'Missing App configuration value: "{$valueName}"',"not-registered":"Firebase Installation is not registered.","installation-not-found":"Firebase Installation not found.","request-failed":'{$requestName} request failed with error "{$serverCode} {$serverStatus}: {$serverMessage}"',"app-offline":"Could not process request. Application offline.","delete-pending-registration":"Can't delete installation while there is a pending registration request."},ue=new Nt(qs,Ls,Ns);function tn(t){return t instanceof Ut&&t.code.includes("request-failed")}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function nn({projectId:t}){return`${ks}/projects/${t}/installations`}function sn(t){return{token:t.token,requestStatus:2,expiresIn:Qs(t.expiresIn),creationTime:Date.now()}}async function rn(t,e){const s=(await e.json()).error;return ue.create("request-failed",{requestName:t,serverCode:s.code,serverMessage:s.message,serverStatus:s.status})}function an({apiKey:t}){return new Headers({"Content-Type":"application/json",Accept:"application/json","x-goog-api-key":t})}function Us(t,{refreshToken:e}){const n=an(t);return n.append("Authorization",$s(e)),n}async function on(t){const e=await t();return e.status>=500&&e.status<600?t():e}function Qs(t){return Number(t.replace("s","000"))}function $s(t){return`${en} ${t}`}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function Ks({appConfig:t,heartbeatServiceProvider:e},{fid:n}){const s=nn(t),r=an(t),i=e.getImmediate({optional:!0});if(i){const l=await i.getHeartbeatsHeader();l&&r.append("x-firebase-client",l)}const o={fid:n,authVersion:en,appId:t.appId,sdkVersion:Zt},c={method:"POST",headers:r,body:JSON.stringify(o)},u=await on(()=>fetch(s,c));if(u.ok){const l=await u.json();return{fid:l.fid||n,registrationStatus:2,refreshToken:l.refreshToken,authToken:sn(l.authToken)}}else throw await rn("Create Installation",u)}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function cn(t){return new Promise(e=>{setTimeout(e,t)})}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function zs(t){return btoa(String.fromCharCode(...t)).replace(/\+/g,"-").replace(/\//g,"_")}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Bs=/^[cdef][\w-]{21}$/,et="";function Gs(){try{const t=new Uint8Array(17);(self.crypto||self.msCrypto).getRandomValues(t),t[0]=112+t[0]%16;const n=Vs(t);return Bs.test(n)?n:et}catch{return et}}function Vs(t){return zs(t).substr(0,22)}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Qe(t){return`${t.appName}!${t.appId}`}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const un=new Map;function ln(t,e){const n=Qe(t);dn(n,e),Hs(n,e)}function dn(t,e){const n=un.get(t);if(n)for(const s of n)s(e)}function Hs(t,e){const n=Ws();n&&n.postMessage({key:t,fid:e}),Ys()}let ne=null;function Ws(){return!ne&&"BroadcastChannel"in self&&(ne=new BroadcastChannel("[Firebase] FID Change"),ne.onmessage=t=>{dn(t.data.key,t.data.fid)}),ne}function Ys(){un.size===0&&ne&&(ne.close(),ne=null)}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Js="firebase-installations-database",Xs=1,le="firebase-installations-store";let Be=null;function at(){return Be||(Be=Rn(Js,Xs,{upgrade:(t,e)=>{switch(e){case 0:t.createObjectStore(le)}}})),Be}async function ke(t,e){const n=Qe(t),r=(await at()).transaction(le,"readwrite"),i=r.objectStore(le),o=await i.get(n);return await i.put(e,n),await r.done,(!o||o.fid!==e.fid)&&ln(t,e.fid),e}async function hn(t){const e=Qe(t),s=(await at()).transaction(le,"readwrite");await s.objectStore(le).delete(e),await s.done}async function $e(t,e){const n=Qe(t),r=(await at()).transaction(le,"readwrite"),i=r.objectStore(le),o=await i.get(n),c=e(o);return c===void 0?await i.delete(n):await i.put(c,n),await r.done,c&&(!o||o.fid!==c.fid)&&ln(t,c.fid),c}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function ot(t){let e;const n=await $e(t.appConfig,s=>{const r=Zs(s),i=er(t,r);return e=i.registrationPromise,i.installationEntry});return n.fid===et?{installationEntry:await e}:{installationEntry:n,registrationPromise:e}}function Zs(t){const e=t||{fid:Gs(),registrationStatus:0};return fn(e)}function er(t,e){if(e.registrationStatus===0){if(!navigator.onLine){const r=Promise.reject(ue.create("app-offline"));return{installationEntry:e,registrationPromise:r}}const n={fid:e.fid,registrationStatus:1,registrationTime:Date.now()},s=tr(t,n);return{installationEntry:n,registrationPromise:s}}else return e.registrationStatus===1?{installationEntry:e,registrationPromise:nr(t)}:{installationEntry:e}}async function tr(t,e){try{const n=await Ks(t,e);return ke(t.appConfig,n)}catch(n){throw tn(n)&&n.customData.serverCode===409?await hn(t.appConfig):await ke(t.appConfig,{fid:e.fid,registrationStatus:0}),n}}async function nr(t){let e=await It(t.appConfig);for(;e.registrationStatus===1;)await cn(100),e=await It(t.appConfig);if(e.registrationStatus===0){const{installationEntry:n,registrationPromise:s}=await ot(t);return s||n}return e}function It(t){return $e(t,e=>{if(!e)throw ue.create("installation-not-found");return fn(e)})}function fn(t){return sr(t)?{fid:t.fid,registrationStatus:0}:t}function sr(t){return t.registrationStatus===1&&t.registrationTime+Xt<Date.now()}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function rr({appConfig:t,heartbeatServiceProvider:e},n){const s=ir(t,n),r=Us(t,n),i=e.getImmediate({optional:!0});if(i){const l=await i.getHeartbeatsHeader();l&&r.append("x-firebase-client",l)}const o={installation:{sdkVersion:Zt,appId:t.appId}},c={method:"POST",headers:r,body:JSON.stringify(o)},u=await on(()=>fetch(s,c));if(u.ok){const l=await u.json();return sn(l)}else throw await rn("Generate Auth Token",u)}function ir(t,{fid:e}){return`${nn(t)}/${e}/authTokens:generate`}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function ct(t,e=!1){let n;const s=await $e(t.appConfig,i=>{if(!pn(i))throw ue.create("not-registered");const o=i.authToken;if(!e&&cr(o))return i;if(o.requestStatus===1)return n=ar(t,e),i;{if(!navigator.onLine)throw ue.create("app-offline");const c=lr(i);return n=or(t,c),c}});return n?await n:s.authToken}async function ar(t,e){let n=await Tt(t.appConfig);for(;n.authToken.requestStatus===1;)await cn(100),n=await Tt(t.appConfig);const s=n.authToken;return s.requestStatus===0?ct(t,e):s}function Tt(t){return $e(t,e=>{if(!pn(e))throw ue.create("not-registered");const n=e.authToken;return dr(n)?Object.assign(Object.assign({},e),{authToken:{requestStatus:0}}):e})}async function or(t,e){try{const n=await rr(t,e),s=Object.assign(Object.assign({},e),{authToken:n});return await ke(t.appConfig,s),n}catch(n){if(tn(n)&&(n.customData.serverCode===401||n.customData.serverCode===404))await hn(t.appConfig);else{const s=Object.assign(Object.assign({},e),{authToken:{requestStatus:0}});await ke(t.appConfig,s)}throw n}}function pn(t){return t!==void 0&&t.registrationStatus===2}function cr(t){return t.requestStatus===2&&!ur(t)}function ur(t){const e=Date.now();return e<t.creationTime||t.creationTime+t.expiresIn<e+Ms}function lr(t){const e={requestStatus:1,requestTime:Date.now()};return Object.assign(Object.assign({},t),{authToken:e})}function dr(t){return t.requestStatus===1&&t.requestTime+Xt<Date.now()}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function hr(t){const e=t,{installationEntry:n,registrationPromise:s}=await ot(e);return s?s.catch(console.error):ct(e).catch(console.error),n.fid}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function fr(t,e=!1){const n=t;return await pr(n),(await ct(n,e)).token}async function pr(t){const{registrationPromise:e}=await ot(t);e&&await e}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function mr(t){if(!t||!t.options)throw Ge("App Configuration");if(!t.name)throw Ge("App Name");const e=["projectId","apiKey","appId"];for(const n of e)if(!t.options[n])throw Ge(n);return{appName:t.name,projectId:t.options.projectId,apiKey:t.options.apiKey,appId:t.options.appId}}function Ge(t){return ue.create("missing-app-config-values",{valueName:t})}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const mn="installations",yr="installations-internal",gr=t=>{const e=t.getProvider("app").getImmediate(),n=mr(e),s=qe(e,"heartbeat");return{app:e,appConfig:n,heartbeatServiceProvider:s,_delete:()=>Promise.resolve()}},wr=t=>{const e=t.getProvider("app").getImmediate(),n=qe(e,mn).getImmediate();return{getId:()=>hr(n),getToken:r=>fr(n,r)}};function vr(){Re(new De(mn,gr,"PUBLIC")),Re(new De(yr,wr,"PRIVATE"))}vr();Fe(Jt,it);Fe(Jt,it,"esm2017");/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Me="analytics",br="firebase_id",Ir="origin",Tr=60*1e3,Ar="https://firebase.googleapis.com/v1alpha/projects/-/apps/{app-id}/webConfig",ut="https://www.googletagmanager.com/gtag/js";/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const D=new Dn("@firebase/analytics");/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const xr={"already-exists":"A Firebase Analytics instance with the appId {$id}  already exists. Only one Firebase Analytics instance can be created for each appId.","already-initialized":"initializeAnalytics() cannot be called again with different options than those it was initially called with. It can be called again with the same options to return the existing instance, or getAnalytics() can be used to get a reference to the already-initialized instance.","already-initialized-settings":"Firebase Analytics has already been initialized.settings() must be called before initializing any Analytics instanceor it will have no effect.","interop-component-reg-failed":"Firebase Analytics Interop Component failed to instantiate: {$reason}","invalid-analytics-context":"Firebase Analytics is not supported in this environment. Wrap initialization of analytics in analytics.isSupported() to prevent initialization in unsupported environments. Details: {$errorInfo}","indexeddb-unavailable":"IndexedDB unavailable or restricted in this environment. Wrap initialization of analytics in analytics.isSupported() to prevent initialization in unsupported environments. Details: {$errorInfo}","fetch-throttle":"The config fetch request timed out while in an exponential backoff state. Unix timestamp in milliseconds when fetch request throttling ends: {$throttleEndTimeMillis}.","config-fetch-failed":"Dynamic config fetch failed: [{$httpStatus}] {$responseMessage}","no-api-key":'The "apiKey" field is empty in the local Firebase config. Firebase Analytics requires this field tocontain a valid API key.',"no-app-id":'The "appId" field is empty in the local Firebase config. Firebase Analytics requires this field tocontain a valid app ID.',"no-client-id":'The "client_id" field is empty.',"invalid-gtag-resource":"Trusted Types detected an invalid gtag resource: {$gtagURL}."},_=new Nt("analytics","Analytics",xr);/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Sr(t){if(!t.startsWith(ut)){const e=_.create("invalid-gtag-resource",{gtagURL:t});return D.warn(e.message),""}return t}function yn(t){return Promise.all(t.map(e=>e.catch(n=>n)))}function Pr(t,e){let n;return window.trustedTypes&&(n=window.trustedTypes.createPolicy(t,e)),n}function Cr(t,e){const n=Pr("firebase-js-sdk-policy",{createScriptURL:Sr}),s=document.createElement("script"),r=`${ut}?l=${t}&id=${e}`;s.src=n?n==null?void 0:n.createScriptURL(r):r,s.async=!0,document.head.appendChild(s)}function Er(t){let e=[];return Array.isArray(window[t])?e=window[t]:window[t]=e,e}async function Or(t,e,n,s,r,i){const o=s[r];try{if(o)await e[o];else{const u=(await yn(n)).find(l=>l.measurementId===r);u&&await e[u.appId]}}catch(c){D.error(c)}t("config",r,i)}async function jr(t,e,n,s,r){try{let i=[];if(r&&r.send_to){let o=r.send_to;Array.isArray(o)||(o=[o]);const c=await yn(n);for(const u of o){const l=c.find(h=>h.measurementId===u),y=l&&e[l.appId];if(y)i.push(y);else{i=[];break}}}i.length===0&&(i=Object.values(e)),await Promise.all(i),t("event",s,r||{})}catch(i){D.error(i)}}function Fr(t,e,n,s){async function r(i,...o){try{if(i==="event"){const[c,u]=o;await jr(t,e,n,c,u)}else if(i==="config"){const[c,u]=o;await Or(t,e,n,s,c,u)}else if(i==="consent"){const[c,u]=o;t("consent",c,u)}else if(i==="get"){const[c,u,l]=o;t("get",c,u,l)}else if(i==="set"){const[c]=o;t("set",c)}else t(i,...o)}catch(c){D.error(c)}}return r}function Rr(t,e,n,s,r){let i=function(...o){window[s].push(arguments)};return window[r]&&typeof window[r]=="function"&&(i=window[r]),window[r]=Fr(i,t,e,n),{gtagCore:i,wrappedGtag:window[r]}}function Dr(t){const e=window.document.getElementsByTagName("script");for(const n of Object.values(e))if(n.src&&n.src.includes(ut)&&n.src.includes(t))return n;return null}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const _r=30,kr=1e3;class Mr{constructor(e={},n=kr){this.throttleMetadata=e,this.intervalMillis=n}getThrottleMetadata(e){return this.throttleMetadata[e]}setThrottleMetadata(e,n){this.throttleMetadata[e]=n}deleteThrottleMetadata(e){delete this.throttleMetadata[e]}}const gn=new Mr;function qr(t){return new Headers({Accept:"application/json","x-goog-api-key":t})}async function Lr(t){var e;const{appId:n,apiKey:s}=t,r={method:"GET",headers:qr(s)},i=Ar.replace("{app-id}",n),o=await fetch(i,r);if(o.status!==200&&o.status!==304){let c="";try{const u=await o.json();!((e=u.error)===null||e===void 0)&&e.message&&(c=u.error.message)}catch{}throw _.create("config-fetch-failed",{httpStatus:o.status,responseMessage:c})}return o.json()}async function Nr(t,e=gn,n){const{appId:s,apiKey:r,measurementId:i}=t.options;if(!s)throw _.create("no-app-id");if(!r){if(i)return{measurementId:i,appId:s};throw _.create("no-api-key")}const o=e.getThrottleMetadata(s)||{backoffCount:0,throttleEndTimeMillis:Date.now()},c=new $r;return setTimeout(async()=>{c.abort()},Tr),wn({appId:s,apiKey:r,measurementId:i},o,c,e)}async function wn(t,{throttleEndTimeMillis:e,backoffCount:n},s,r=gn){var i;const{appId:o,measurementId:c}=t;try{await Ur(s,e)}catch(u){if(c)return D.warn(`Timed out fetching this Firebase app's measurement ID from the server. Falling back to the measurement ID ${c} provided in the "measurementId" field in the local Firebase config. [${u==null?void 0:u.message}]`),{appId:o,measurementId:c};throw u}try{const u=await Lr(t);return r.deleteThrottleMetadata(o),u}catch(u){const l=u;if(!Qr(l)){if(r.deleteThrottleMetadata(o),c)return D.warn(`Failed to fetch this Firebase app's measurement ID from the server. Falling back to the measurement ID ${c} provided in the "measurementId" field in the local Firebase config. [${l==null?void 0:l.message}]`),{appId:o,measurementId:c};throw u}const y=Number((i=l==null?void 0:l.customData)===null||i===void 0?void 0:i.httpStatus)===503?dt(n,r.intervalMillis,_r):dt(n,r.intervalMillis),h={throttleEndTimeMillis:Date.now()+y,backoffCount:n+1};return r.setThrottleMetadata(o,h),D.debug(`Calling attemptFetch again in ${y} millis`),wn(t,h,s,r)}}function Ur(t,e){return new Promise((n,s)=>{const r=Math.max(e-Date.now(),0),i=setTimeout(n,r);t.addEventListener(()=>{clearTimeout(i),s(_.create("fetch-throttle",{throttleEndTimeMillis:e}))})})}function Qr(t){if(!(t instanceof Ut)||!t.customData)return!1;const e=Number(t.customData.httpStatus);return e===429||e===500||e===503||e===504}class $r{constructor(){this.listeners=[]}addEventListener(e){this.listeners.push(e)}abort(){this.listeners.forEach(e=>e())}}async function Kr(t,e,n,s,r){if(r&&r.global){t("event",n,s);return}else{const i=await e,o=Object.assign(Object.assign({},s),{send_to:i});t("event",n,o)}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function zr(){if(kn())try{await Mn()}catch(t){return D.warn(_.create("indexeddb-unavailable",{errorInfo:t==null?void 0:t.toString()}).message),!1}else return D.warn(_.create("indexeddb-unavailable",{errorInfo:"IndexedDB is not available in this environment."}).message),!1;return!0}async function Br(t,e,n,s,r,i,o){var c;const u=Nr(t);u.then(w=>{n[w.measurementId]=w.appId,t.options.measurementId&&w.measurementId!==t.options.measurementId&&D.warn(`The measurement ID in the local Firebase config (${t.options.measurementId}) does not match the measurement ID fetched from the server (${w.measurementId}). To ensure analytics events are always sent to the correct Analytics property, update the measurement ID field in the local config or remove it from the local config.`)}).catch(w=>D.error(w)),e.push(u);const l=zr().then(w=>{if(w)return s.getId()}),[y,h]=await Promise.all([u,l]);Dr(i)||Cr(i,y.measurementId),r("js",new Date);const m=(c=o==null?void 0:o.config)!==null&&c!==void 0?c:{};return m[Ir]="firebase",m.update=!0,h!=null&&(m[br]=h),r("config",y.measurementId,m),y.measurementId}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Gr{constructor(e){this.app=e}_delete(){return delete Ie[this.app.options.appId],Promise.resolve()}}let Ie={},At=[];const xt={};let Ve="dataLayer",Vr="gtag",St,vn,Pt=!1;function Hr(){const t=[];if(_n()&&t.push("This is a browser extension environment."),Nn()||t.push("Cookies are not available."),t.length>0){const e=t.map((s,r)=>`(${r+1}) ${s}`).join(" "),n=_.create("invalid-analytics-context",{errorInfo:e});D.warn(n.message)}}function Wr(t,e,n){Hr();const s=t.options.appId;if(!s)throw _.create("no-app-id");if(!t.options.apiKey)if(t.options.measurementId)D.warn(`The "apiKey" field is empty in the local Firebase config. This is needed to fetch the latest measurement ID for this Firebase app. Falling back to the measurement ID ${t.options.measurementId} provided in the "measurementId" field in the local Firebase config.`);else throw _.create("no-api-key");if(Ie[s]!=null)throw _.create("already-exists",{id:s});if(!Pt){Er(Ve);const{wrappedGtag:i,gtagCore:o}=Rr(Ie,At,xt,Ve,Vr);vn=i,St=o,Pt=!0}return Ie[s]=Br(t,At,xt,e,St,Ve,n),new Gr(t)}function Yr(t=qn()){t=Qt(t);const e=qe(t,Me);return e.isInitialized()?e.getImmediate():Jr(t)}function Jr(t,e={}){const n=qe(t,Me);if(n.isInitialized()){const r=n.getImmediate();if(Ln(e,n.getOptions()))return r;throw _.create("already-initialized")}return n.initialize({options:e})}function Xr(t,e,n,s){t=Qt(t),Kr(vn,Ie[t.app.options.appId],e,n,s).catch(r=>D.error(r))}const Ct="@firebase/analytics",Et="0.10.8";function Zr(){Re(new De(Me,(e,{options:n})=>{const s=e.getProvider("app").getImmediate(),r=e.getProvider("installations-internal").getImmediate();return Wr(s,r,n)},"PUBLIC")),Re(new De("analytics-internal",t,"PRIVATE")),Fe(Ct,Et),Fe(Ct,Et,"esm2017");function t(e){try{const n=e.getProvider(Me).getImmediate();return{logEvent:(s,r,i)=>Xr(n,s,r,i)}}catch(n){throw _.create("interop-component-reg-failed",{reason:n})}}}Zr();const ei={apiKey:"AIzaSyCk3y7jgkkKlNOOdyMr1X-M0-Npyxcae_U",authDomain:"inventory-management-090999.firebaseapp.com",projectId:"inventory-management-090999",storageBucket:"inventory-management-090999.firebasestorage.app",messagingSenderId:"438790134101",appId:"1:438790134101:web:3aaa1ff1f9b426cb5277dc",measurementId:"G-K1BSF601RY"},Ke=Un(ei),gi=Qn(Ke),je=$n(Ke),wi=Kn(Ke);typeof window<"u"&&Yr(Ke);typeof window<"u"&&console.log("Firestore offline persistence is enabled by default in modern Firebase versions");const ti=t=>{if(t instanceof Bn)return t.toDate();if(t instanceof Date)return t;if(typeof t=="string"){const e=t.trim();if(/^\d{4}-\d{2}-\d{2}$/.test(e)){const[n,s,r]=e.split("-").map(Number);return new Date(n,s-1,r)}return new Date(t)}if(typeof t=="number")return new Date(t);if(!t)return new Date;try{return new Date(t)}catch(e){return console.warn("Failed to convert timestamp to date:",t,e),new Date}},vi=t=>{if(!t||typeof t!="object")return t;const e={...t},n=["createdAt","updatedAt","lastActivity","uploadedAt","generatedAt","lastScanned"],s=r=>{if(!r||typeof r!="object")return r;const i={...r};return n.forEach(o=>{i[o]&&(i[o]=ti(i[o]))}),Array.isArray(i)?i.map(o=>s(o)):(Object.keys(i).forEach(o=>{i[o]&&typeof i[o]=="object"&&(i[o]=s(i[o]))}),i)};return s(e)},tt=async()=>{try{const t=je.currentUser;t?console.log("User already authenticated:",t.uid):(console.log("Initializing anonymous authentication..."),await zn(je),await new Promise((e,n)=>{const s=je.onAuthStateChanged(r=>{s(),r&&r.uid?(console.log("Anonymous authentication initialized successfully:",r.uid),e(r)):n(new Error("Anonymous authentication failed - no user returned"))});setTimeout(()=>{s(),n(new Error("Anonymous authentication timeout"))},5e3)}))}catch(t){throw console.error("Anonymous authentication failed:",t),t}},He=async()=>new Promise((t,e)=>{const n=je.onAuthStateChanged(s=>{n(),t(s)});setTimeout(()=>{n(),e(new Error("Authentication state check timeout"))},5e3)}),bi=async()=>{try{console.log("Ensuring authentication for storage operations...");let t=await He();if(t||(console.log("No current user, initializing anonymous auth..."),await tt(),t=await He()),!t)throw new Error("Failed to initialize authentication");try{if(!await t.getIdToken()&&(console.warn("User authenticated but no valid token, refreshing..."),await t.reload(),!await t.getIdToken()))throw new Error("Unable to get valid authentication token")}catch(e){if(console.warn("Token error, trying to re-authenticate:",e),await tt(),!await He())throw new Error("Failed to refresh authentication")}console.log("Storage authentication verified for user:",t.uid)}catch(t){throw console.error("Failed to ensure storage authentication:",t),new Error("Failed to authenticate for storage operations. Please check your connection and try again.")}};function ni(){return b.useEffect(()=>{(async()=>{try{await tt()}catch(e){console.error("Failed to initialize anonymous authentication:",e)}})()},[]),d.jsx(_s,{children:d.jsx(Os,{children:d.jsx(b.Suspense,{fallback:d.jsx(js,{}),children:d.jsxs(xn,{children:[d.jsx(K,{path:"/",element:d.jsx(Ot,{})}),d.jsx(K,{path:"/projects",element:d.jsx(Ot,{})}),d.jsx(K,{path:"/item/:id",element:d.jsx(si,{})}),d.jsx(K,{path:"/project/:id",element:d.jsx(ri,{})}),d.jsx(K,{path:"/project/:id/item/add",element:d.jsx(ii,{})}),d.jsx(K,{path:"/project/:id/edit-item/:itemId",element:d.jsx(ai,{})}),d.jsx(K,{path:"/project/:id/transaction/add",element:d.jsx(oi,{})}),d.jsx(K,{path:"/project/:id/transaction/:transactionId/edit",element:d.jsx(ci,{})}),d.jsx(K,{path:"/project/:id/transaction/:transactionId",element:d.jsx(ui,{})})]})})})})}const Ot=b.lazy(()=>Z(()=>import("./Projects-CJJ4GWd8.js"),__vite__mapDeps([0,1,2,3,4,5,6,7]))),si=b.lazy(()=>Z(()=>import("./ItemDetail-BM_5545j.js"),__vite__mapDeps([8,1,2,5,3,4,9,10,7]))),ri=b.lazy(()=>Z(()=>import("./ProjectDetail-DpcdaZ5w.js"),__vite__mapDeps([11,2,1,3,4,9,7,5,6]))),ii=b.lazy(()=>Z(()=>import("./AddItem-Cc4NBOc0.js"),__vite__mapDeps([12,2,1,3,4,13,7]))),ai=b.lazy(()=>Z(()=>import("./EditItem-Di6yNp5W.js"),__vite__mapDeps([14,2,1,3,4,13,7]))),oi=b.lazy(()=>Z(()=>import("./AddTransaction-CMB-L-Es.js"),__vite__mapDeps([15,2,1,13,3,4,9,16,7,10]))),ci=b.lazy(()=>Z(()=>import("./EditTransaction-IpCmw-_l.js"),__vite__mapDeps([17,2,1,3,4,9,16,7]))),ui=b.lazy(()=>Z(()=>import("./TransactionDetail-Cybsxcqq.js"),__vite__mapDeps([18,2,1,3,4,5,7]))),li=new As({defaultOptions:{queries:{staleTime:5*60*1e3,gcTime:10*60*1e3,refetchOnWindowFocus:!1}}});We.createRoot(document.getElementById("root")).render(d.jsx(In.StrictMode,{children:d.jsx(Ss,{client:li,children:d.jsx(Sn,{children:d.jsx(ni,{})})})}));export{vi as c,gi as d,bi as e,d as j,wi as s,yi as u};
//# sourceMappingURL=index-DRwKqTma.js.map
