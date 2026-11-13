import Image from "next/image";

/** Flat geographic artwork. The full interactive globe lives in the Observatory. */
export default function GlobeCardPreview() {
  return (
    <div className="hero-globe-preview" aria-hidden="true">
      <Image
        src="/images/world/globe-card-flat.svg"
        alt=""
        width={142}
        height={142}
        unoptimized
      />
    </div>
  );
}
