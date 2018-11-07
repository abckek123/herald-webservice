/**
 * 竞赛组队数据库
 */

const db = require('sqlongo')('team')

// 队伍信息 (11项，tid,currentPeople,publishedDate为生成项)
db.team = {
  tid:         'text primary key not null', // 团队唯一id
  masterName:  'text not null',
  cardnum:   'text not null',
  qq:          'text not null',
  teamName:    'text not null',
  projectName: 'text not null',
  currentPeople:'text not null',
  maxPeople:   'int not null',
  deadLine:    'text not null',
  publishedDate:'text not null',
  description: 'text not null'
}

// 对更新时间进行索引
//db`create index if not exists teamIndex on team(updateTime)`

// 报名信息  （10项）
db.registration = {
  rid:         'text primary key not null', // 报名唯一id
  tid:         'text not null',             // 报名的队伍id
  //teamName:    'text not null',             // 队伍名称
  applicant:    'text not null',             // 报名人姓名
  cardnum:     'text not null',           // 报名人学号
  qq:           'text not null',
  description: 'text not null',             // 报名人简述理由
  applicationDate:'text not null',          // 请求发布日期
  status:      'int not null',      // 状态 0('pending'),1('accepted'),2('rejected'),3('canceled'),4('abandoned')
  updateDate:   'int not null',             // 更新日期，
  responseText:'text'               // 目标队伍队长回应信息
}

module.exports = db
