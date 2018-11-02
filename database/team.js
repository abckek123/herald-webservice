/**
 * 竞赛组队数据库
 */

const db = require('sqlongo')('team')

// 队伍信息
db.team = {
  tid:         'text primary key not null', // 团队唯一id
  masterName:  'text not null',
  schoolNum:   'text not null',
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

// 报名信息
db.registration = {
  rid:         'text primary key not null', // 报名唯一id
  tid:         'text not null',    // 报名的队伍id
  teamName:    'text not null',
  name:        'text not null',    // 报名人姓名
  schoolNum:     'text not null',    // 报名人一卡通号
  qq:           'text not null',
  description: 'text not null',    // 报名人自我介绍
  applicationDate:'text not null',
  status:      'int not null',     // 状态 0('pending'),1('accepted'),2('rejected'),3('canceled')
  updateTime:   'int not null',
  responseText:'text'
}

module.exports = db