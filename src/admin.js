console.log("Hello");
const configs = [];
const config =  
    {bookurl:"https://big5.quanben.io/"  ,elementType:"div",class:"main",headingkey:"h1.headline",paragraphkey:"p"};
configs.push(config);
const config2 =  
    {bookurl:"https://ixdzs.tw/"  ,elementType:"article",class:"page-content",headingkey:"h3",paragraphkey:"p"};
 configs.push(config2);
 const jstr =JSON.stringify({configuraions:configs}, null, 2);
 console.log(jstr);
 const readjson = JSON.parse(jstr);
 const index = readjson.configuraions.findIndex((x) => x.bookurl === "ddaaa");

 console.log(index);

