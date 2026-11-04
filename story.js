// 미러리아 (디자인 팀 시안, 법률 검토 46번): 측정 횟수로만 열리는 이야기. 풍경은 코드 그림이고 측정값·위치와 연결하지 않음
function rng(s){return function(){s|=0;s=s+0x6D2B79F5|0;var t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
var uid=0;
function ridgeY(x,y,a,s){return y+a*(Math.sin(x*.013+s)+.5*Math.sin(x*.031+s*2.3)+.25*Math.sin(x*.07+s*3.7))}
function ridge(y,a,s,c,o){var d='M-5 640L-5 '+ridgeY(-5,y,a,s).toFixed(1);for(var x=0;x<=310;x+=5)d+='L'+x+' '+ridgeY(x,y,a,s).toFixed(1);return '<path d="'+d+'L310 640Z" fill="'+c+'"'+(o?' opacity="'+o+'"':'')+'/>'}
function pine(x,b,h,c,r){var w=h*.26,t=4+(h>70?2:0),d='M'+x+' '+(b-h);for(var i=1;i<=t;i++){var k=i/t,yy=b-h+h*k*.94,ww=w*k;d+='L'+(x+ww*(.9+r()*.3)).toFixed(1)+' '+yy.toFixed(1)+'L'+(x+ww*.55).toFixed(1)+' '+(yy-h*.02).toFixed(1)}d+='L'+(x+1.5)+' '+b+'L'+(x-1.5)+' '+b;for(i=t;i>=1;i--){k=i/t;yy=b-h+h*k*.94;ww=w*k;d+='L'+(x-ww*.55).toFixed(1)+' '+(yy-h*.02).toFixed(1)+'L'+(x-ww*(.9+r()*.3)).toFixed(1)+' '+yy.toFixed(1)}return '<path d="'+d+'Z" fill="'+c+'"/>'}
function pines(y,a,s,c,n,h0,h1,seed){var r=rng(seed),o='';for(var i=0;i<n;i++){var x=-8+316*(i+r()*.8)/n,b=ridgeY(x,y,a,s)+4;o+=pine(x,b,h0+(h1-h0)*r(),c,r)}return o}
function rounds(y,c,n,seed,s0,s1){var r=rng(seed),o='';for(var i=0;i<n;i++){var x=-6+312*i/n+r()*6,rr=s0+(s1-s0)*r();o+='<circle cx="'+x.toFixed(1)+'" cy="'+(y-rr*.5).toFixed(1)+'" r="'+rr.toFixed(1)+'" fill="'+c+'"/>'}return o+'<rect x="-5" y="'+(y-3)+'" width="310" height="8" fill="'+c+'"/>'}
function grad(id,st,v){return '<linearGradient id="'+id+'" x1="0" y1="0" x2="'+(v?1:0)+'" y2="1">'+st.map(function(s,i){return '<stop offset="'+(s[1]!=null?s[1]:i/(st.length-1))+'" stop-color="'+s[0]+'"'+(s[2]!=null?' stop-opacity="'+s[2]+'"':'')+'/>'}).join('')+'</linearGradient>'}
function glow(id,c){return '<radialGradient id="'+id+'"><stop offset="0" stop-color="'+c+'" stop-opacity=".95"/><stop offset=".25" stop-color="'+c+'" stop-opacity=".45"/><stop offset="1" stop-color="'+c+'" stop-opacity="0"/></radialGradient>'}
function fog(p,y,h,c,o){var id=p+'f'+(uid++);return {d:grad(id,[[c,0,0],[c,.55,o],[c,1,0]]),b:'<rect x="-5" y="'+y+'" width="310" height="'+h+'" fill="url(#'+id+')"/>'}}
function walker(x,y,c){return '<g fill="'+c+'" transform="translate('+x+' '+y+')"><circle cx="0" cy="-15" r="2.6"/><path d="M-2.4-12h4.8l1 8h-1.4l-.4 7h-1.2l-.8-6-.8 6h-1.2l-.4-7h-1.4z"/></g>'}
function stack(defs,body){return '<defs>'+defs+'</defs>'+body}

function lake(p){var u=p+'l',F=fog(u,270,70,'#F6C48F',.5);
 var trees=rounds(320,'#20373F',24,7,10,20);
 return stack(grad(u+'s',[['#143A4C',0],['#3F6A78',.28],['#D98E6B',.46],['#F7C78C',.54]])+grad(u+'w',[['#F2BC8B',0],['#B98C7F',.14],['#3C6B78',.42],['#0E2C38',1]])+glow(u+'g','#FFE3AE')+F.d,
 '<rect width="300" height="340" fill="url(#'+u+'s)"/><circle cx="196" cy="282" r="140" fill="url(#'+u+'g)"/><circle cx="196" cy="282" r="20" fill="#FFF0CC"/>'+ridge(280,12,1.4,'#7E8C86')+F.b+ridge(300,8,3.1,'#44606A')+trees+
 '<rect y="320" width="300" height="300" fill="url(#'+u+'w)"/><g transform="translate(0,640) scale(1,-1)" opacity=".42">'+ridge(300,8,3.1,'#2B4852').replace('L310 640Z','L310 330L-5 330Z').replace('M-5 640','M-5 330')+rounds(320,'#1A3039',24,7,10,20)+'</g>'+
 [[196,328,46],[190,342,30],[202,356,38],[194,374,22],[198,392,30],[192,414,18],[200,436,24]].map(function(a){return '<ellipse cx="'+a[0]+'" cy="'+a[1]+'" rx="'+a[2]+'" ry="1.8" fill="#FFE6BC" opacity=".72"/>'}).join('')+
 ridge(548,14,5,'#0B1E27')+[12,22,31,262,274,286,247].map(function(x,i){return '<path d="M'+x+' 560Q'+(x+3)+' 510 '+(x+(i%2?9:-5))+' '+(490+i*4)+'" stroke="#0B1E27" stroke-width="2" fill="none"/>'}).join(''),1)}

function forest(p){var u=p+'o',a=fog(u,250,90,'#E2C6CC',.6),b=fog(u,310,90,'#BDA7C2',.5),c=fog(u,370,90,'#6F6C90',.42);
 return stack(grad(u+'s',[['#4F618C',0],['#8E8FB6',.34],['#F2B596',.43],['#F8C8A4',.47]])+glow(u+'g','#FFEBD8')+a.d+b.d+c.d+grad(u+'r',[['#FFEBD8',0,.42],['#FFEBD8',1,0]]),
 '<rect width="300" height="620" fill="url(#'+u+'s)"/><circle cx="208" cy="238" r="210" fill="url(#'+u+'g)"/><circle cx="208" cy="238" r="20" fill="#FFF4E6"/>'+
 ridge(270,10,2.2,'#AFA3BE')+pines(282,8,1.1,'#938DB0',44,28,46,3)+a.b+pines(322,10,2.7,'#5F6588',28,60,94,11)+b.b+
 '<g style="mix-blend-mode:screen"><path d="M208 238L40 620H-40ZM208 238L150 620H78ZM208 238L286 620H226Z" fill="url(#'+u+'r)"/></g>'+
 pines(382,12,4.2,'#353D5E',17,120,180,23)+c.b+ridge(440,10,1.9,'#262C45')+
 '<path d="M150 640C205 560 74 520 170 452C186 442 176 436 170 432L184 432C196 440 208 450 196 468C148 520 280 560 250 640Z" fill="#D8C6C0"/><path d="M178 640C210 570 120 524 182 452" stroke="#A99A9A" stroke-width="2" fill="none" opacity=".6"/>'+
 walker(180,452,'#141A2E')+
 pine(30,640,420,'#161B30',rng(5))+pine(278,640,360,'#1B2038',rng(8))+
 [...Array(46)].map(function(_,i){var r=rng(i+40),x=r()*300,y=500+r()*125;return '<path d="M'+x.toFixed(0)+' '+y.toFixed(0)+'q'+(r()*6-3).toFixed(1)+' -9 '+(r()*8-4).toFixed(1)+' -'+(11+r()*10).toFixed(0)+'" stroke="'+(r()>.5?'#8A9BB0':'#525F78')+'" stroke-width="1.6" fill="none"/>'}).join(''),1)}

function sea(p){var u=p+'e',F=fog(u,276,44,'#FFF3DA',.8);
 function cloud(x,y,s){return '<g fill="#FFFDF4" transform="translate('+x+' '+y+') scale('+s+')"><ellipse cx="0" cy="0" rx="46" ry="15"/><circle cx="-18" cy="-12" r="17"/><circle cx="8" cy="-20" r="23"/><circle cx="31" cy="-8" r="14"/></g><g fill="#D3E8E2" opacity=".75" transform="translate('+x+' '+y+') scale('+s+')"><ellipse cx="2" cy="9" rx="44" ry="6"/></g>'}
 return stack(grad(u+'s',[['#47A6AE',0],['#A9DBD3',.28],['#FCE9C6',.46]])+grad(u+'w',[['#7CCCC4',0],['#2E939B',.2],['#0E5866',.7],['#0A3C4B',1]])+glow(u+'g','#FFF6D8')+F.d,
 '<rect width="300" height="300" fill="url(#'+u+'s)"/><circle cx="96" cy="270" r="150" fill="url(#'+u+'g)"/>'+cloud(92,120,1.5)+cloud(248,180,1)+cloud(30,214,.7)+
 '<rect y="290" width="300" height="340" fill="url(#'+u+'w)"/>'+F.b+
 [...Array(30)].map(function(_,i){var r=rng(i+90),y=296+i*i*.34,x=r()*280,w=14+i*2.2;return '<path d="M'+x.toFixed(0)+' '+y.toFixed(0)+'q'+(w/2).toFixed(0)+' -3 '+w.toFixed(0)+' 0" stroke="#D6F2EA" stroke-width="'+(.7+i*.03).toFixed(1)+'" fill="none" opacity=".55"/>'}).join('')+
 '<g transform="translate(86 300)"><path d="M-14 16h30l-5 7H-9z" fill="#3B2A22"/><path d="M1 14V-30L20 12z" fill="#FFF8EA"/><path d="M-1 14V-22L-13 12z" fill="#F2C074"/></g>'+
 '<path d="M310 200C270 204 244 222 232 262C222 296 206 322 190 352C170 392 146 430 142 470C140 510 180 560 170 640H310Z" fill="#14505B"/><path d="M310 226C282 230 262 246 250 278C236 316 214 346 202 380C188 420 176 450 186 490C196 530 210 580 204 640H310Z" fill="#0C3B46"/><path d="M310 198C272 202 246 220 234 258C258 240 286 232 310 232Z" fill="#E5B24E"/><path d="M310 216C282 222 262 236 246 266C270 250 292 244 310 244Z" fill="#B98A31"/>'+
 '<g transform="translate(266 214)"><path d="M-9 8L-6-44H6L9 8Z" fill="#FFF8EC"/><path d="M-8-8L-7.200-22H7.200L8-8Z" fill="#CC5740"/><rect x="-8" y="-52" width="16" height="9" fill="#2A3A40"/><rect x="-5" y="-51" width="10" height="7" fill="#FFE29C"/><path d="M-9-52L0-62L9-52Z" fill="#CC5740"/></g><path d="M260 165L90 130L90 186Z" fill="#FFF0BE" opacity=".22"/>',1)}

function pass(p){var u=p+'p',A=fog(u,250,110,'#FFE9C7',.6);
 function dune(d,c){return '<path d="'+d+'" fill="'+c+'"/>'}
 return stack(grad(u+'s',[['#E89A6A',0],['#F6C08B',.28],['#FDE8C4',.5]])+glow(u+'g','#FFFFFF')+A.d+grad(u+'d1',[['#F4B27F',0],['#D97C4F',1]])+grad(u+'d2',[['#D2714A',0],['#9D4632',1]])+grad(u+'d3',[['#8B3B30',0],['#4B1E22',1]]),
 '<rect width="300" height="620" fill="url(#'+u+'s)"/><circle cx="170" cy="250" r="200" fill="url(#'+u+'g)"/><circle cx="170" cy="250" r="16" fill="#fff"/>'+
 '<path d="M-5 342L60 310L96 326L142 300L172 320L214 296L262 322L305 304V400H-5Z" fill="#EBB48D" opacity=".85"/>'+
 '<g fill="#C9825F" opacity=".92" transform="translate(142 300)"><rect x="-16" y="-34" width="6" height="42"/><rect x="11" y="-26" width="6" height="34"/><path d="M-20-38H22V-32H-20z"/><path d="M-14-34A15 15 0 0 1 12-30V-22A13 13 0 0 0-10-22Z"/></g>'+
 A.b+dune('M-5 360C60 320 110 330 170 358C220 382 260 366 305 340V640H-5Z','url(#'+u+'d1)')+
 '<path d="M170 358C188 386 186 420 160 452" stroke="#FFE4C0" stroke-width="1.4" fill="none" opacity=".6"/>'+
 dune('M-5 438C50 400 100 410 150 438C210 470 260 450 305 418V640H-5Z','url(#'+u+'d2)')+
 '<g fill="#3B1A1C"><rect x="60" y="408" width="2.2" height="42"/><path d="M62 408C76 412 82 420 96 416L92 428C82 430 74 424 62 422Z" fill="#C93E37"/></g>'+
 walker(150,438,'#3B1A1C')+'<path d="M151 438L196 462L184 462L148 440Z" fill="#6E2C25" opacity=".55"/>'+
 dune('M-5 540C70 490 120 500 170 530C220 560 262 548 305 520V640H-5Z','url(#'+u+'d3)'),1)}

function night(p){var u=p+'n',r=rng(77),st='';for(var i=0;i<110;i++){var x=r()*300,y=r()*330,a=.3+r()*.7,s=.5+r()*1.1;st+='<circle cx="'+x.toFixed(0)+'" cy="'+y.toFixed(0)+'" r="'+s.toFixed(1)+'" fill="#fff" opacity="'+a.toFixed(2)+'"/>'}
 var F=fog(u,340,100,'#F56E93',.34);
 function lamp(x,y){return '<circle cx="'+x+'" cy="'+y+'" r="12" fill="url(#'+u+'g)"/><circle cx="'+x+'" cy="'+y+'" r="2" fill="#FFF0BA"/>'}
 function bal(x,y,s){return '<g transform="translate('+x+' '+y+') scale('+s+')"><path d="M0-16C10-16 13-8 11-2C9 3 4 7 3 10H-3C-4 7-9 3-11-2C-13-8-10-16 0-16Z" fill="#22103F"/><rect x="-3" y="12" width="6" height="4" fill="#22103F"/><circle cx="0" cy="-3" r="20" fill="url(#'+u+'g)" opacity=".35"/></g>'}
 return stack(grad(u+'s',[['#120C36',0],['#34165F',.28],['#8A2576',.47],['#F0507F',.6],['#FBA777',.68]])+glow(u+'g','#FFD98F')+F.d+glow(u+'m','#FFF1D6'),
 '<rect width="300" height="620" fill="url(#'+u+'s)"/>'+st+'<circle cx="228" cy="96" r="52" fill="url(#'+u+'m)" opacity=".7"/><circle cx="228" cy="96" r="13" fill="#FFF4DD"/><circle cx="233" cy="92" r="11" fill="#34165F" opacity=".88"/>'+
 ridge(420,16,1.3,'#4F1C60')+F.b+ridge(450,12,3.3,'#34124F')+
 (function(){var H=[[8,470,40,20],[44,462,34,24],[74,472,46,18],[112,456,30,22],[138,468,44,20],[176,458,36,26],[208,472,42,18],[244,464,34,22],[272,474,36,18],[28,444,26,18],[92,438,28,18],[160,436,24,18],[224,442,30,18]],o='',r=rng(31);H.sort(function(a,b){return a[1]-b[1]}).forEach(function(h){var x=h[0],y=h[1],w=h[2],t=h[3],rh=w*.32;o+='<path d="M'+(x-2)+' '+(y-t)+'L'+(x+w*(.35+r()*.3)).toFixed(1)+' '+(y-t-rh).toFixed(1)+'L'+(x+w+2)+' '+(y-t)+'V'+(y+6)+'H'+(x-2)+'Z" fill="#1D0D33"/>';var n=Math.max(1,Math.floor(w/14));for(var i=0;i<n;i++){if(r()>.28)o+='<rect x="'+(x+5+i*w/n).toFixed(1)+'" y="'+(y-t+6)+'" width="5" height="7" fill="'+(r()>.5?'#FFC56F':'#F49A5A')+'"/>'}});return o})()+'<path d="M-5 640V486C60 474 110 480 150 480C190 480 240 474 305 486V640Z" fill="#160A2C"/>'+
 lamp(70,492)+lamp(214,494)+walker(150,520,'#FFE3B8'),1)}

export const STORY=[
{n:'미루아르 호수',ch:'1장',f:lake,fg:'#FFF6E7',pn:'#10242D',yb:318,ln:'물결 아래에\n똑같은 세상이 하나 더 있어요.',
 lt:'이 편지가 닿았다면, 물결 아래를 한번 내려다봐 주세요.\n\n당신이 걸은 만큼 여기에도 길이 하나 났어요. 어제까지 없던 길이에요.\n\n저는 이 길을 따라 숲으로 가 볼게요.',hh:'미러리아를\n같이 걸어 볼까요?'},
{n:'스페키오 숲',ch:'2장',f:forest,fg:'#FFF6E7',pn:'#1C2138',yb:376,ln:'미루아르 호수를 한 바퀴 돌자\n물 아래로 숲이 비쳤어요.',
 lt:'여기는 해가 지는 쪽이 반대예요.\n\n그래도 나무 그림자는 그쪽과 똑같이 길어요. 당신이 멈추면 저도 앉아서 쉬어요. 급할 건 없어요.\n\n바다 냄새가 나기 시작했어요.',hh:'스페키오 숲을\n걷고 있어요'},
{n:'에스페호 항구',ch:'3장',f:sea,fg:'#0C3B46',pn:'#0B3440',yb:340,ln:'숲이 끝나는 곳에서\n등대 두 개가 마주 봐요.',
 lt:'등대 불빛이 물 위로 길게 떨어져요.\n\n그 불빛을 따라가면 그쪽 등대와 이쪽 등대가 한 줄로 이어져요. 어느 쪽이 진짜인지 여기 사람들도 몰라요.\n\n저는 고개 너머로 갈게요.',hh:'에스페호 항구까지\n걸어왔어요'},
{n:'슈피겔 고개',ch:'4장',f:pass,fg:'#4B1E22',pn:'#3B1719',yb:372,ln:'오래된 문이 물 위에도\n물 아래에도 서 있어요.',
 lt:'오래된 문 아래 앉아 지나온 길을 봤어요.\n\n미루아르 호수도, 스페키오 숲도, 에스페호 항구도 보여요. 당신이 지나온 곳만 이쪽에 있어요.\n\n밤이 오면 별도 물 아래에 뜰 거예요.',hh:'슈피겔 고개를\n넘고 있어요'},
{n:'페일리 시티',ch:'5장',f:night,fg:'#FFF1E0',pn:'#160A2C',yb:488,ln:'이곳에서는\n별이 발밑에 떠요.',
 lt:'이게 마지막 편지예요.\n\n이쪽에서는 고개를 숙이면 하늘이 보여요. 그 하늘 너머에 당신이 있겠지요. 손을 흔들어 볼게요.\n\n아, 그거 아세요? 당신이 지나온 다섯 곳의 이름은 모두 나라마다 다른 말로 \'거울\'이에요.\n\n길은 아직 거기 있어요. 언제든 다시 걸어요.',hh:'별이 발밑에 뜨는\n마을에 왔어요'}];
export function storyMirror(i){var R=STORY[i],yb=R.yb,k=Math.max(1,360/yb),t='translate('+((300-300*k)/2).toFixed(1)+' '+(360-yb*k).toFixed(1)+') scale('+k.toFixed(3)+')',r=rng(i+200),rp='';for(var j=0;j<34;j++){var y=364+j*j*.21,x=r()*270,w=14+r()*44;rp+='<path d="M'+x.toFixed(0)+' '+y.toFixed(0)+'q'+(w/2).toFixed(0)+' 2.5 '+w.toFixed(0)+' 0" stroke="#fff" stroke-width=".8" fill="none" opacity="'+(.16+r()*.22).toFixed(2)+'"/>'}
 return '<svg class="sc" viewBox="0 0 300 620" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><clipPath id="mc"><rect width="300" height="360"/></clipPath><linearGradient id="mt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="'+R.pn+'" stop-opacity=".22"/><stop offset="1" stop-color="'+R.pn+'" stop-opacity=".82"/></linearGradient></defs><g clip-path="url(#mc)"><g id="ms" transform="'+t+'">'+R.f('a')+'</g></g><g transform="translate(0 720) scale(1 -1)"><g clip-path="url(#mc)"><use href="#ms"/></g></g><rect y="360" width="300" height="260" fill="url(#mt)"/>'+rp+'<rect y="359.300" width="300" height="1.4" fill="#fff" opacity=".55"/></svg>'}

const sceneMemo = {};                                                      // 같은 그림을 다시 만들지 않음
export const storyScene = (i, p) => sceneMemo[i + p] ??= STORY[i].f(p);
