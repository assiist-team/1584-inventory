import{m as u,j as m}from"./index.js";import{d as g,u as h}from"./router.js";function k({fallback:t,className:o,children:e,title:s}){const a=g(),n=h(),i=u(),c=r=>{r.preventDefault();try{const p=i.pop(n.pathname+n.search)||t;a(p)}catch{a(t)}};return m.jsx("a",{href:t,onClick:c,className:o,title:s,children:e})}export{k as C};
//# sourceMappingURL=ContextBackLink.js.map
