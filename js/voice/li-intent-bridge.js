/**
 * 「荔 / LI」吉祥物意图桥接器
 * 复用四足机器人项目中的 xiaozhi-intent-bridge.js 思想，
 * 将自然语言语音识别结果和 LLM 回复提取为 3D 吉祥物的动作与情绪指令。
 */

export class LiIntentBridge {
  constructor() {
    this.actionRulesA = [
      { triggers: [/缩|藏|躲|闭合|拉紧|收口|变身|荔枝球|压惊|害羞|收起/i], action: "retract_shell", emotion: "shy" },
      { triggers: [/出来|探出|伸头|张开|放松|看看|微笑|露头/i], action: "pop_out", emotion: "happy" },
      { triggers: [/你好|嗨|哈喽|早上好|下午好|晚上好|挥手/i], action: "wave", emotion: "happy" },
      { triggers: [/对|是|赞成|真棒|好|收到|明白/i], action: "nod", emotion: "friendly" },
      { triggers: [/不|没有|别|错/i], action: "shake", emotion: "curious" },
      { triggers: [/想|算|考虑|分析|等等|查查/i], action: "think", emotion: "thinking" },
    ];

    this.actionRulesD = [
      { triggers: [/飞|漂浮|浮动|零重力|失重|漫游|悬浮|升空/i], action: "zero_g_float", emotion: "energetic" },
      { triggers: [/面罩|发光|hud|全息|扫描|计算|分析/i], action: "visor_hud_pulse", emotion: "curious" },
      { triggers: [/天线|信号|呼叫|通信|接收|发报|莫尔斯/i], action: "antenna_beacon", emotion: "energetic" },
      { triggers: [/喷气|加速|推进|跃迁|冲/i], action: "jetpack_boost", emotion: "excited" },
      { triggers: [/收到|指挥官|敬礼|报告|就绪/i], action: "salute", emotion: "proud" },
      { triggers: [/你好|哈喽|星际|探险/i], action: "salute", emotion: "happy" },
    ];
  }

  /**
   * 解析自然语言输入或 LLM 回复中的动作与情绪
   * @param {string} text - 原始文本（可包含 [action:xxx] 标签）
   * @param {"hoodie"|"astro"} role - 当前吉祥物角色
   * @returns {{ actions: string[], emotions: string[], cleanText: string }}
   */
  resolveIntent(text, role = "hoodie") {
    if (!text || typeof text !== "string") {
      return { actions: [], emotions: [], cleanText: "" };
    }

    // 1. 优先提取显式标签
    const actionTags = [];
    const emotionTags = [];
    const actionRegex = /\[action:([a-zA-Z0-9_\-]+)\]/g;
    const emotionRegex = /\[emotion:([a-zA-Z0-9_\-]+)\]/g;

    let match;
    while ((match = actionRegex.exec(text)) !== null) {
      actionTags.push(match[1]);
    }
    while ((match = emotionRegex.exec(text)) !== null) {
      emotionTags.push(match[1]);
    }

    const cleanText = text
      .replace(/\[(action|emotion):[a-zA-Z0-9_\-]+\]/g, "")
      .trim();

    // 2. 如果无显式标签，通过中文关键字规则匹配
    if (actionTags.length === 0) {
      const rules = role === "astro" ? this.actionRulesD : this.actionRulesA;
      for (const rule of rules) {
        if (rule.triggers.some((regex) => regex.test(cleanText))) {
          actionTags.push(rule.action);
          if (rule.emotion && !emotionTags.includes(rule.emotion)) {
            emotionTags.push(rule.emotion);
          }
          break;
        }
      }
    }

    return {
      actions: actionTags,
      emotions: emotionTags,
      cleanText,
    };
  }

  /**
   * 本地智能响应（当无网络或无外部大模型时提供即时离线反馈）
   */
  getLocalReply(text, role = "hoodie") {
    const isAstro = role === "astro";
    const intent = this.resolveIntent(text, role);

    if (isAstro) {
      if (intent.actions.includes("zero_g_float")) {
        return {
          raw: "[action:zero_g_float] 启动零重力平衡巡航！指挥官，当前空间环境各项指标平稳。",
          clean: "启动零重力平衡巡航！指挥官，当前空间环境各项指标平稳。",
          actions: ["zero_g_float"],
          emotions: ["energetic"],
        };
      }
      if (intent.actions.includes("antenna_beacon")) {
        return {
          raw: "[action:antenna_beacon] 天线已捕捉到深空脉冲！数据包解码完毕，准备传输。",
          clean: "天线已捕捉到深空脉冲！数据包解码完毕，准备传输。",
          actions: ["antenna_beacon"],
          emotions: ["curious"],
        };
      }
      return {
        raw: "[action:salute] [action:visor_hud_pulse] 荔小星收到！深空探索站已连接，随时执行下一项任务！",
        clean: "荔小星收到！深空探索站已连接，随时执行下一项任务！",
        actions: ["salute", "visor_hud_pulse"],
        emotions: ["happy"],
      };
    } else {
      // Hoodie
      if (intent.actions.includes("retract_shell")) {
        return {
          raw: "[action:retract_shell] [emotion:shy] 哎呀，我拉紧抽绳躲一会儿！现在我是一颗新鲜荔枝，敲三下才开门哦~",
          clean: "哎呀，我拉紧抽绳躲一会儿！现在我是一颗新鲜荔枝，敲三下才开门哦~",
          actions: ["retract_shell"],
          emotions: ["shy"],
        };
      }
      if (intent.actions.includes("pop_out")) {
        return {
          raw: "[action:pop_out] [emotion:happy] 兜帽松开啦！荔小卫出来啦，今天也要元气满满呀！",
          clean: "兜帽松开啦！荔小卫出来啦，今天也要元气满满呀！",
          actions: ["pop_out"],
          emotions: ["happy"],
        };
      }
      return {
        raw: "[action:nod] [emotion:happy] 收到啦！本荔枝的卫衣兜帽又暖和又舒适，一直陪着你呢。",
        clean: "收到啦！本荔枝的卫衣兜帽又暖和又舒适，一直陪着你呢。",
        actions: ["nod"],
        emotions: ["happy"],
      };
    }
  }
}
