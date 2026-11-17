package com.lifeatlas.app;

/** Pure calculation layer: raw native speeds are m/s; all displayed speeds are km/h. */
public final class ExpeditionFixFilter {
    public static final class Fix {
        public final double lat, lon, accuracy, timeMs;
        public final Double speedMps, altitude, verticalAccuracy;
        public Fix(double lat,double lon,double accuracy,double timeMs,Double speedMps,Double altitude,Double verticalAccuracy) {
            this.lat=lat;this.lon=lon;this.accuracy=accuracy;this.timeMs=timeMs;
            this.speedMps=speedMps;this.altitude=altitude;this.verticalAccuracy=verticalAccuracy;
        }
    }
    public static final class Result {
        public final double distanceMeters, speedKmh;
        public final Double altitude;
        Result(double distance,double speed,Double altitude){this.distanceMeters=distance;this.speedKmh=speed;this.altitude=altitude;}
    }
    private Fix previous;
    private Double filteredAltitude;
    private double lastAltitudeAt;
    private final double limit;
    public ExpeditionFixFilter(String category) {
        limit="WALK".equals(category)?20:"TREK".equals(category)?25:"CYCLE".equals(category)?100:"DRIVE".equals(category)?250:400;
    }
    public Result accept(Fix fix) {
        if(!Double.isFinite(fix.lat)||!Double.isFinite(fix.lon)||!Double.isFinite(fix.accuracy)||!Double.isFinite(fix.timeMs)||Math.abs(fix.lat)>90||Math.abs(fix.lon)>180||fix.accuracy<0||fix.accuracy>40||fix.timeMs<=0)return null;
        double dt=previous==null?0:(fix.timeMs-previous.timeMs)/1000;
        if(previous!=null&&dt<=0)return null;
        boolean gap=previous==null||dt>120;
        double distance=gap?0:distance(previous,fix),computed=dt>0&&!gap?distance/dt*3.6:0;
        if(!gap&&(computed>limit||distance<Math.max(3,Math.min(12,(previous.accuracy+fix.accuracy)/4))))return null;
        double reported=fix.speedMps==null?Double.NaN:fix.speedMps*3.6;
        double speed=!gap&&Double.isFinite(reported)&&reported>=0&&reported<=limit&&Math.abs(reported-computed)<=Math.max(8,computed*.6)?reported:computed;
        Double altitude=null;
        if(gap)filteredAltitude=null;
        if(fix.altitude!=null&&Double.isFinite(fix.altitude)&&fix.altitude>=-500&&fix.altitude<=9000&&fix.verticalAccuracy!=null&&Double.isFinite(fix.verticalAccuracy)&&fix.verticalAccuracy>=0&&fix.verticalAccuracy<=25) {
            if(filteredAltitude==null||Math.abs(fix.altitude-filteredAltitude)<=Math.max(15,(fix.timeMs-lastAltitudeAt)/1000*3+fix.verticalAccuracy)) {
                filteredAltitude=filteredAltitude==null||dt>=30?fix.altitude:filteredAltitude*.65+fix.altitude*.35;
                lastAltitudeAt=fix.timeMs;altitude=filteredAltitude;
            }
        }
        previous=fix;return new Result(distance,speed,altitude);
    }
    private static double distance(Fix a,Fix b){
        double lat=Math.toRadians(b.lat-a.lat),lon=Math.toRadians(b.lon-a.lon);
        double h=Math.sin(lat/2)*Math.sin(lat/2)+Math.cos(Math.toRadians(a.lat))*Math.cos(Math.toRadians(b.lat))*Math.sin(lon/2)*Math.sin(lon/2);
        return 6371000*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));
    }
}
