import CrudWorkspace from "@/components/CrudWorkspace";
import { Zap } from "lucide-react";

export default function GamificationWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "gamification",
        title: "Gamification",
        subtitle: "Rewards, badges, leaderboards, and engagement campaigns",
        icon: Zap,
        accentColor: "text-yellow-600",
        idField: "campaign_id",
        statusField: "status",
        searchFields: ["campaign_id", "name", "type", "target_segment"],
        apiBase: "/gamification/v1/campaigns",
        pageSize: 25,
        columns: [
          { key: "campaign_id",     label: "Campaign ID" },
          { key: "name",            label: "Campaign Name",   sortable: true },
          { key: "type",            label: "Type",            sortable: true },
          { key: "target_segment",  label: "Segment",         sortable: true },
          { key: "points_reward",   label: "Points",          sortable: true },
          { key: "badge_name",      label: "Badge",           sortable: true },
          { key: "start_date",      label: "Start",           sortable: true },
          { key: "end_date",        label: "End",             sortable: true },
          { key: "participants",    label: "Participants",     sortable: true,
            render: (v) => Number(v).toLocaleString() },
          { key: "status",          label: "Status",          sortable: true },
        ],
        fields: [
          { key: "name",           label: "Campaign Name",    type: "text",    required: true },
          { key: "type",           label: "Type",             type: "text",    required: true },
          { key: "target_segment", label: "Target Segment",   type: "text" },
          { key: "points_reward",  label: "Points Reward",    type: "number" },
          { key: "badge_name",     label: "Badge Name",       type: "text" },
          { key: "start_date",     label: "Start Date",       type: "text" },
          { key: "end_date",       label: "End Date",         type: "text" },
        ],
      }}
    />
  );
}
