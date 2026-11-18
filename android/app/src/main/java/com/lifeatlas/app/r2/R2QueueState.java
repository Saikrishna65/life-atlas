package com.lifeatlas.app.r2;

import androidx.work.WorkInfo;
import java.util.*;
import org.json.*;

/** Scheduler facts only: never assumes an unchanged byte count means a failed upload. */
final class R2QueueState {
  static Map<String, List<WorkInfo>> index(List<WorkInfo> work) {
    Map<String, List<WorkInfo>> result = new HashMap<>();
    for (WorkInfo info : work)
      for (String tag : info.getTags())
        if (tag.startsWith("atlas-r2-"))
          result.computeIfAbsent(tag.substring(9), k -> new ArrayList<>()).add(info);
    return result;
  }

  private static int rank(WorkInfo info) {
    switch (info.getState()) {
      case RUNNING:
        return 4;
      case ENQUEUED:
        return 3;
      case BLOCKED:
        return 2;
      default:
        return 1;
    }
  }

  static JSONObject describe(JSONObject job, List<WorkInfo> work, long now) throws Exception {
    WorkInfo best = null;
    for (WorkInfo info : work) if (best == null || rank(info) > rank(best)) best = info;
    JSONObject out =
        new JSONObject().put("workerState", best == null ? "MISSING" : best.getState().name());
    if (best != null) {
      String wait = "";
      switch (best.getState() == WorkInfo.State.RUNNING
          ? WorkInfo.STOP_REASON_NOT_STOPPED
          : best.getStopReason()) {
        case WorkInfo.STOP_REASON_QUOTA:
          wait = "QUOTA";
          break;
        case WorkInfo.STOP_REASON_BACKGROUND_RESTRICTION:
        case WorkInfo.STOP_REASON_APP_STANDBY:
          wait = "BACKGROUND";
          break;
        case WorkInfo.STOP_REASON_CONSTRAINT_CONNECTIVITY:
          wait = "NETWORK";
          break;
        case WorkInfo.STOP_REASON_TIMEOUT:
          wait = "TIME_LIMIT";
          break;
      }
      if (!wait.isEmpty()) out.put("androidWait", wait);
      out.put("attempts", best.getRunAttemptCount()).put("stopReason", best.getStopReason());
      if (best.getNextScheduleTimeMillis() > now
          && best.getNextScheduleTimeMillis() != Long.MAX_VALUE)
        out.put("nextAttemptAt", best.getNextScheduleTimeMillis());
      out.put(
          "retryScheduled",
          best.getState() == WorkInfo.State.ENQUEUED && best.getRunAttemptCount() > 0);
    }
    out.put("canRecover", eligible(job) && !active(work));
    return out;
  }

  static boolean active(List<WorkInfo> work) {
    for (WorkInfo info : work) if (!info.getState().isFinished()) return true;
    return false;
  }

  static boolean retryable(String code) {
    return Set.of(
            "NETWORK_UNAVAILABLE",
            "REMOTE_TEMPORARY_FAILURE",
            "R2_REQUEST_FAILED",
            "TRANSFER_INTERRUPTED",
            "ANDROID_TRANSFER_STOPPED",
            "BACKGROUND_UPLOAD_RESTRICTED",
            "STORAGE_OPERATION_FAILED")
        .contains(code);
  }

  static boolean eligible(JSONObject job) {
    if (!job.optString("slot").equals("public")
        || !job.optString("direction").equals("upload")
        || job.optString("tripSelectionId").isEmpty()
        || job.optString("tripCollection").isEmpty()) return false;
    String state = job.optString("status");
    return Set.of("queued", "preparing", "uploading", "verifying", "interrupted").contains(state)
        || (state.equals("failed") && retryable(job.optString("error")));
  }

  static JSONArray repair(R2Repository repository, Map<String, List<WorkInfo>> work)
      throws Exception {
    JSONArray ids = new JSONArray();
    // Only durable, previously approved public jobs can be repaired without a new review.
    JSONArray jobs = repository.jobs();
    for (int i = 0; i < jobs.length(); i++) {
      JSONObject job = jobs.getJSONObject(i);
      String id = job.getString("id");
      if (!eligible(job) || active(work.getOrDefault(id, Collections.emptyList()))) continue;
      try {
        repository.checkCredentialRevision(job);
      } catch (R2Exception changed) {
        continue;
      }
      repository.update(
          id,
          current -> {
            if (!eligible(current)) return;
            current.put("status", "queued").put("speed", 0).remove("error");
            ids.put(id);
          });
    }
    return ids;
  }
}
