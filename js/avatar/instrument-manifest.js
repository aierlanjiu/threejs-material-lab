// Visual identities only. Audio bindings are supplied by a later song analysis.
const designs = [
  ['one-piece/luffy','路飞','草帽麦克风','melody','#db775d','草帽顶罩与红环'],
  ['one-piece/zoro','索隆','三弦脊贝斯','melody','#748e65','三道弦脊与剑柄琴头'],
  ['one-piece/nami','娜美','航海手风琴','polyphonic','#d5a15c','航海刻度风箱与橘子旋钮'],
  ['one-piece/sanji','山治','海蓝爵士鼓','percussion','#709cac','卷眉鼓面与金色镲片'],
  ['one-piece/chopper','乔巴','鹿角木琴','melody','#d18a9e','鹿角琴槌与十字端板'],
  ['one-piece/robin','罗宾','花瓣竖琴','polyphonic','#9a7aa9','花瓣扇形弦架'],
  ['one-piece/usopp','乌索普','弹弓吉他','polyphonic','#b58b62','弹弓琴头与护目镜拾音器'],
  ['one-piece/ace','艾斯','焰红萨克斯','melody','#d77953','火焰形铜金喇叭口'],
  ['one-piece/law','罗','刻度电子键盘','polyphonic','#638f91','精密刻度与圆形旋钮'],
  ['one-piece/shanks','香克斯','酒红大提琴','melody','#af6971','切痕琴头与金色琴弓'],
  ['dragon-ball/goku','悟空','星球麦克风','melody','#d6a260','四星球底座'],
  ['dragon-ball/vegeta','贝吉塔','装甲电吉他','polyphonic','#8a82b4','锐角装甲切面'],
  ['dragon-ball/bulma','布尔玛','胶囊合成器','polyphonic','#74a6b5','胶囊旋钮'],
  ['dragon-ball/krillin','克林','六点双手鼓','percussion','#cc9d65','六点鼓面'],
  ['dragon-ball/piccolo','比克','披风长笛','melody','#91a57a','竹绿笛身与白披风包覆'],
  ['dragon-ball/frieza','弗利萨','角形特雷门琴','melody','#b5a0c6','白紫角形天线'],
  ['dragon-ball/cell','沙鲁','甲壳模块合成器','polyphonic','#87a37a','六角面板与甲壳外框'],
  ['dragon-ball/gohan','悟饭','书页小钢琴','polyphonic','#849cb9','书页形琴盖'],
  ['dragon-ball/buu','布欧','糖果大号','melody','#d69dae','圆喇叭口与糖果按键'],
  ['dragon-ball/trunks','特兰克斯','剑鞘肩背键盘','polyphonic','#859bc1','剑鞘背板'],
  ['naruto/naruto','鸣人','螺旋麦克风','melody','#d39454','螺旋网罩'],
  ['naruto/sasuke','佐助','闪电电吉他','polyphonic','#8985b6','闪电形琴颈'],
  ['naruto/sakura','小樱','花瓣小军鼓','percussion','#d89aa8','花瓣鼓耳'],
  ['naruto/itachi','鼬','乌羽尺八','melody','#a96c75','乌羽形护套'],
  ['naruto/gaara','我爱罗','砂陶乌杜鼓','percussion','#bf956f','葫芦轮廓与侧孔'],
  ['naruto/ninja-06','金发忍者','金色陶笛','melody','#c5ac70','柔软黏土轮廓'],
  ['naruto/madara','斑','铠甲大鼓','percussion','#a7646c','铠甲鼓框与团扇鼓槌'],
  ['naruto/jiraiya','自来也','卷轴三味线','polyphonic','#b77d76','卷轴琴头与蛤蟆拨片'],
  ['naruto/pain','佩恩','六管管风琴','polyphonic','#9b819f','六根高低音管']
];
export const INSTRUMENTS = Object.freeze(designs.map(([id,name,instrument,family,accent,motif]) => Object.freeze({
  id, name, instrument, family, accent, motif, theme: id.split('/')[0],
  asset: new URL(`../../assets/instruments/${id.replace('/','-')}.svg`, import.meta.url).href
})));
export const instrumentById = id => INSTRUMENTS.find(item => item.id === id);
export const instrumentsForTheme = theme => INSTRUMENTS.filter(item => item.theme === theme);
