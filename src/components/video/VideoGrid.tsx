"use client";
import { memo } from "react";
import { Play } from "lucide-react";
import type { VideoResult } from "@/lib/video/search";
const VideoCard = memo(function VideoCard({ video, eager, onOpen, onChannel }: { video: VideoResult; eager: boolean; onOpen(video: VideoResult): void; onChannel?(id: string, name: string): void }) {
  return <article className="video-result"><button className="video-result-open" aria-label={video.title} onClick={() => onOpen(video)}>
    <div className="video-thumbnail"><div className="video-thumbnail-placeholder" aria-hidden="true"><Play size={28}/></div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={video.thumbnail} alt="" loading={eager ? "eager" : "lazy"} decoding="async" onError={(event) => { event.currentTarget.style.visibility = "hidden"; }} referrerPolicy="no-referrer"/>
      {video.duration && <span>{video.duration}</span>}<i aria-hidden="true"><Play size={19} fill="currentColor"/></i>
    </div><div className="video-result-copy"><div><h2>{video.title}</h2></div></div>
  </button>{video.channelId && onChannel ? <button className="video-card-channel" onClick={() => onChannel(video.channelId!, video.channel)}>{video.channel || "View channel"}</button> : <p className="video-card-channel">{video.channel}</p>}</article>;
});
export default memo(function VideoGrid({ videos, onOpen, onChannel }: { videos: VideoResult[]; onOpen(video: VideoResult): void; onChannel?(id: string, name: string): void }) {
  return <section className="video-results" aria-label="Video search results">{videos.map((video, index) => <VideoCard key={video.id} video={video} eager={index < 4} onOpen={onOpen} onChannel={onChannel}/>)}</section>;
});
