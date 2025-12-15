import{r as o}from"./vendor.js";import{m as i}from"./index.js";import{d as n,u as r}from"./router.js";function v(){const e=n(),a=r(),s=i();return o.useCallback((t,c)=>{try{(typeof t!="number"||t>0)&&s.push(a.pathname+a.search)}catch{}e(t,c)},[e,s,a.pathname,a.search])}export{v as u};
//# sourceMappingURL=useStackedNavigate.js.map
