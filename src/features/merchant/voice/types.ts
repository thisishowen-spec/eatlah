export type VoiceLang = "zh" | "en";

export type AnnouncementKind = "new_order" | "pending_overdue";

export type Announcement = {
  /** 去重 id：new_order:<orderId> / pending_overdue:<orderId>:<round> */
  id: string;
  kind: AnnouncementKind;
  text: string;
  lang: VoiceLang;
  /** 数字越大越优先；超时提醒优先于新订单 */
  priority: number;
};
