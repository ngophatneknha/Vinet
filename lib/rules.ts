export const QUESTIONS = [
 'Ảnh có liên quan đến chủ đề của văn bản không?',
 'Ảnh và văn bản có mô tả cùng loại sự kiện không?',
 'Ảnh và văn bản có thuộc cùng sự kiện cụ thể không?',
 'Người, địa điểm và thời gian có khớp không?',
 'Có đủ bằng chứng để quyết định không?',
 'Ảnh có phải ảnh minh hoạ hoặc ảnh tư liệu chung không?',
];
export const LABELS:Record<string,string>={matched:'Đúng ngữ cảnh',out_of_context:'Ngoài ngữ cảnh',ambiguous:'Mơ hồ',invalid:'Không hợp lệ',needs_review:'Cần kiểm tra'};
export const RAW_LABELS:Record<string,string>={approved:'Đạt',rejected:'Không đạt',review:'Cần kiểm tra'};
export const REASONS=['Ảnh lỗi / không đọc được','Logo, quảng cáo hoặc ảnh trang trí','Nội dung ngoài phạm vi','Nội dung nhạy cảm bị loại theo SOP','Ảnh trùng / sai bài','Thiếu bằng chứng / thông tin','Khác (ghi rõ)'];
export function validateAnnotation(x:any){
 if(!x||!Object.hasOwn(LABELS,x.label))throw Error('Chọn một nhãn hợp lệ.');
 if(!Array.isArray(x.answers)||x.answers.length!==6||x.answers.some((a:any)=>typeof a?.yes!=='boolean'||![0,1,2].includes(a?.uncertainty)))throw Error('Trả lời đủ 6 câu và mức độ không chắc chắn 0–2.');
 if(typeof x.reason!=='string'||x.reason.trim().length<10||x.reason.length>10000)throw Error('Ghi lý do từ 10 đến 10.000 ký tự.');
 if(!Array.isArray(x.evidence)||x.evidence.length>20||x.evidence.some((s:any)=>typeof s!=='string'||!/^https?:\/\/\S+$/i.test(s)))throw Error('Bằng chứng phải là các URL http/https hợp lệ.');
 if(['matched','out_of_context'].includes(x.label)&&!x.evidence.length)throw Error('Cần ít nhất một URL bằng chứng để kết luận.');
 if(x.label==='matched'&&(!x.answers[2].yes||!x.answers[3].yes||!x.answers[4].yes||x.answers[5].yes))throw Error('Nhãn đúng ngữ cảnh chưa nhất quán với câu 3–6.');
 if(x.label==='out_of_context'&&(x.answers[2].yes||!x.answers[4].yes))throw Error('Ngoài ngữ cảnh cần khác sự kiện và đủ bằng chứng.');
 const score=x.answers.reduce((s:number,a:any)=>s+a.uncertainty,0);
 return {score,difficulty:score<=3?'easy':score<=7?'medium':'hard'};
}
export function consensus(rows:{label:string}[]){
 if(rows.length!==2)return {state:'open',label:null};
 const agree=rows[0].label===rows[1].label&&['matched','out_of_context'].includes(rows[0].label);
 return {state:agree?'approved':'review',label:agree?rows[0].label:null};
}
export function agreement(rows:{a:string,b:string}[]){
 const n=rows.length;if(!n)return {n:0,agreement:null,kappa:null};
 const observed=rows.filter(x=>x.a===x.b).length/n;
 const expected=Object.keys(LABELS).reduce((s,k)=>s+rows.filter(x=>x.a===k).length*rows.filter(x=>x.b===k).length/(n*n),0);
 return {n,agreement:observed,kappa:expected===1?null:(observed-expected)/(1-expected)};
}
