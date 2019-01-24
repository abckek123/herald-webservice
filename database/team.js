const MongoClient = require('mongodb').MongoClient;
const assert = require('assert');
const config = require('./mongodb-secret.json')

const user = encodeURIComponent(config.user);
const password = encodeURIComponent(config.pwd);
const authMechanism = 'DEFAULT';

// Connection URL
const url = `mongodb://${user}:${password}@${config.host}:${config.port}/webservice?authMechanism=${authMechanism}`
let mongodb = null;
let mongoClient=null;

const getCollection = async(col) => {
  if (mongodb) {
    return mongodb.collection(col)
  } else {
    mongoClient = await MongoClient.connect(url, { useNewUrlParser: true })
    mongodb = mongoClient.db("webservice")
    return mongodb.collection(col)
  }
}
const getMongoClient=async ()=>{
  if (mongoClient) {
    return mongoClient
  } else {
    mongoClient = await MongoClient.connect(url, { useNewUrlParser: true })
    mongodb = mongoClient.db("webservice")
    return mongoClient
  }
}
//初始化竞赛组队数据库
(async ()=>{
  const col_team=await getCollection('team');
  const col_regis=await getCollection('registration');
  
  //按照发布时间/申请更新时间 作为索引
  await col_team.createIndex({publishTime:-1});
  await col_team.createIndex('tid',{unique:true});
  await col_regis.createIndex({updateTime:-1});
  await col_regis.createIndex('rid',{unique:true});

  //创建组队项用户视图
  if((await mongodb.collections()).find(each=>each.collectionName=='userTeamView')){
    await mongodb.dropCollection('userTeamView')
  }
  await mongodb.command({
    create:'userTeamView',
    viewOn:'team',
    pipeline:[{$project:{
      _id:0,
      tid:1,
      masterName:1,
      cardnum:1,
      teamName:1,
      projectName:1,
      QQ:1,
      currentPeople:1,
      maxPeople:1,
      description:1,
      publishTime:1,
      updateTime:1,//保留
      endTime:1,
      status:1,
      deleteReason:1
    }}]
  }).catch(err=>console.log(err.message))

  //创建申请项用户视图
  if((await mongodb.collections()).find(each=>each.collectionName=='userRegisView')){
    await mongodb.dropCollection('userRegisView')
  }
  await mongodb.command({
    create:'userRegisView',
    viewOn:'registration',
    pipeline:[{$project:{
      _id:0,
      rid:1,
      tid:1,
      applicantName:1,
      QQ:1,
      description:1,
      requestTime:1,
      updateTime:1,
      cardnum:1,
      status:1,
      responseText:1
    }}]
  }).catch(err=>console.log(err.message))

})();

module.exports = {
  getCollection,
  getMongoClient
}