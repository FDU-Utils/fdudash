// This classifies dedicated spaces; it does not claim that booking occupancy was fetched.
const lims='https://lims.fudan.edu.cn/teacherInformationCenter/openReservation/mainindex';
const booking='https://booking.fudan.edu.cn/reservation/fe/site/special/special?id=51';
export function reservationInfo(room,groups=[]){
 const name=String(room.name||'').replace(/\s+/g,'');
 if(/^(?:HWLL|H恒隆物理楼|恒隆物理楼|物理楼)537$/.test(name))return {required:true,basis:'published-policy',url:lims,policyUrl:'https://ee.fudan.edu.cn/electron/Data/List/hysyy'};
 const dedicated=/实验室|实验间|机房|研讨室|会议室|报告厅|多功能厅|相辉堂/.test(name)||groups.some(group=>['实验楼','机房','报告厅'].includes(group.name));
 if(dedicated)return {required:true,basis:'dedicated-space',url:/实验|机房/.test(name)||groups.some(g=>['实验楼','机房'].includes(g.name))?lims:booking,policyUrl:null};
 return {required:null,basis:'unverified',url:booking};
}
