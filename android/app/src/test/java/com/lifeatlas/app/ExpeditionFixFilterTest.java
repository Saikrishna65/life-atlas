package com.lifeatlas.app;
import org.junit.Test;
import static org.junit.Assert.*;
public class ExpeditionFixFilterTest {
 private ExpeditionFixFilter.Fix point(double meters,double seconds,Double speed,Double altitude,Double vertical){return new ExpeditionFixFilter.Fix(0,meters/111194.9266,3,100000+seconds*1000,speed,altitude,vertical);}
 @Test public void convertsMetersPerSecondOnceAndRejectsBadSpeed(){
  ExpeditionFixFilter walking=new ExpeditionFixFilter("WALK");walking.accept(point(0,0,null,null,null));assertEquals(5.04,walking.accept(point(14,10,1.4,null,null)).speedKmh,.01);
  ExpeditionFixFilter bike=new ExpeditionFixFilter("DRIVE");bike.accept(point(0,0,null,null,null));assertEquals(72,bike.accept(point(200,10,166.7,null,null)).speedKmh,.1);
  assertNull(bike.accept(point(10000,11,166.7,null,null)));
 }
 @Test public void stationaryNoiseAndDuplicateTimeDoNotAddDistance(){
  ExpeditionFixFilter filter=new ExpeditionFixFilter("WALK");filter.accept(point(0,0,null,null,null));assertNull(filter.accept(point(.5,3,0.0,null,null)));assertNull(filter.accept(point(10,0,null,null,null)));assertEquals(10,filter.accept(point(10,10,null,null,null)).distanceMeters,.01);
 }
 @Test public void missingVerticalAccuracyAndSpikesAreNotAltitudes(){
  ExpeditionFixFilter filter=new ExpeditionFixFilter("WALK");assertNull(filter.accept(point(0,0,null,1000.0,null)).altitude);assertEquals(0,filter.accept(point(10,10,null,0.0,3.0)).altitude,.01);assertNull(filter.accept(point(20,20,null,8000.0,3.0)).altitude);
 }
 @Test public void gpsGapReanchorsWithoutTeleportDistance(){
  ExpeditionFixFilter filter=new ExpeditionFixFilter("DRIVE");filter.accept(point(0,0,null,null,null));assertEquals(0,filter.accept(point(10000,200,null,null,null)).distanceMeters,.01);
 }
}
