import { ScheduleRow, type ScheduleRowData } from "@/components/schedule-row";
import type { ScheduleItem } from "@/db/queries";
import { buildCaption } from "@/lib/instagram/caption";
import { previewImageUrl } from "@/lib/instagram/preview-url";
import { sourceLabel } from "@/lib/memes/manual";
import { toLocalInputValue } from "@/lib/schedule/local-time";
import { dayKey, formatDayHeading, formatTime } from "@/lib/schedule/slots";

export type ScheduleGroup = { key: string; heading: string; rows: ScheduleRowData[] };

/** Plain, serializable data for one schedule row (times formatted in the schedule's timezone). */
export function toScheduleRow(it: ScheduleItem, timezone: string): ScheduleRowData {
  return {
    id: it.id,
    title: it.post.title,
    source: sourceLabel(it.post),
    imageUrl: it.post.cloudinaryUrl,
    time: formatTime(it.scheduledAt, timezone),
    whenValue: toLocalInputValue(it.scheduledAt, timezone),
    status: it.status,
    error: it.error,
    caption: it.caption,
    defaultCaption: buildCaption(it.post),
    previewUrl: previewImageUrl(it.post.cloudinaryPublicId),
  };
}

/** Group posts by calendar day in the schedule's timezone, in the order given. */
export function groupScheduleItems(items: ScheduleItem[], timezone: string, now: Date): ScheduleGroup[] {
  const groups = new Map<string, ScheduleGroup>();
  for (const it of items) {
    const key = dayKey(it.scheduledAt, timezone);
    const group = groups.get(key) ?? { key, heading: formatDayHeading(it.scheduledAt, timezone, now), rows: [] };
    group.rows.push(toScheduleRow(it, timezone));
    groups.set(key, group);
  }
  return [...groups.values()];
}

/** The framed table of posts, grouped by day. Stacks into blocks on narrow screens. */
export function ScheduleTable({ groups, timezone, username }: { groups: ScheduleGroup[]; timezone: string; username: string | null }) {
  return (
    <div className="md:overflow-x-auto">
      <table className="w-full text-left max-md:block md:min-w-[40rem]">
        <thead className="border-b bg-muted/40 text-xs text-muted-foreground max-md:hidden">
          <tr>
            <th scope="col" className="py-2.5 pr-3 pl-4 font-medium">Meme</th>
            <th scope="col" className="px-3 py-2.5 font-medium">Time</th>
            <th scope="col" className="px-3 py-2.5 font-medium">Status</th>
            <th scope="col" className="py-2.5 pr-4 pl-3 text-right font-medium">Actions</th>
          </tr>
        </thead>
        {groups.map((group) => (
          <tbody key={group.key} className="divide-y border-b last:border-b-0 max-md:block">
            <tr className="bg-muted/20 max-md:block">
              <th scope="colgroup" colSpan={4} className="py-2 pr-3 pl-4 text-sm font-semibold">
                {group.heading}
              </th>
            </tr>
            {group.rows.map((row) => (
              <ScheduleRow key={row.id} row={row} timezone={timezone} username={username} />
            ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}
