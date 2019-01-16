/******************************************************************************
* Animated item relationship distance map
*
* Part of Gnod, the Global Network of Dreams. (c) Marek Gibney
* 
* Animates html elements with id's "s0", "s1",...
*
* Tries to keep the distances between them as given by an array
* gnodMap.aid[][], where aid[4][7] is the proposed distance 
* "s4" should have to "s7".
* 
* The element with id "s0" allways stays in the center.
*
* settings can be made by altering several values in gnodMap, e.g.
*  gnodMap.scale=0.4; // makes the map smaller
*
* Margin between the items can be created by putting them into a 
* container with padding.
*****************************************************************************/

/** 
 * A moving HTML element
 */
function mg_2d_element(id)
{
 this.id=id;
 this.x=0;
 this.y=0;
 this.speedX=0;
 this.speedY=0;
 this.element=document.getElementById("s"+this.id);
 // this.name=this.element.innerHTML;
 this.width =this.element.offsetWidth;
 this.height=this.element.offsetHeight;
 this.inertia=0.7;
 this.fixed=false; // if the element is pinned
 
 this.update=function(damper)
 {
  this.element.style.left=this.x-this.width /2+"px";
  this.element.style.top =this.y-this.height/2+"px";

  if(!this.fixed)
  {
   this.x+=this.speedX/damper;
   this.y+=this.speedY/damper;  
  }
  this.speedX*=this.inertia;
  this.speedY*=this.inertia;
 }
}
 
/** 
 * Given two rectangular items, this function checks if they overlap.
 * If so, it moves item1 away from item2.
 * @param item1 A rectangular item. needs to have x,y,width and height properties
 * @param item2 A rectangular item. needs to have x,y,width and height properties
 * @param force A force of 1 means the items will de-overlap in 1 step. A force of 0.5 means they will move 50% of the way needed to de-overlap.
 */
function repelItem(item1,item2,force)
{
 // Distance of the item centers:
 var dx=item1.x-item2.x;
 var dy=item1.y-item2.y;

 // Extents of the "shall not overlap" parts of the items from their centers:
 var extentsSumX=(item1.width +item2.width) /2;
 var extentsSumY=(item1.height+item2.height)/2;

 // Calculate how far we would have to move into each direction to escape the overlap:
 // If the number is negative, it means there already is a gap between the items
 // and the number states the distance to item2 in that direction. Pretty cool, uh?
 var right = -dx+extentsSumX;
 var left  =  dx+extentsSumX;
 var down  = -dy+extentsSumY;
 var up    =  dy+extentsSumY;

 // If there already is a gap between the items, there is no overlap:
 if(left<0 || right<0 || up<0 || down<0) return;

 // Calculate the horizontal and vertical movements nedded to get out:
 var moveX=right;
 if (left<right) moveX=-left;
 var moveY=down; 
 if (up<down)    moveY=-up;

 // We mainly go into the direction of the shortest escape, which is either on the x
 // or on the y axis. The movement on the other axis will be scaled down proportionally.
 // This movement should be somewhat similar the movement of a physical object.
 // (Overlapping physical objects are a strange thought anyway)
 xy_ratio=Math.abs(moveX)/Math.abs(moveY);
 if (xy_ratio<1) moveY*=xy_ratio*xy_ratio;
 else            moveX/=xy_ratio*xy_ratio;
 
 if(!item1.fixed)
 { 
  item1.x+=moveX*force;
  item1.y+=moveY*force;
 }
}

function GnodMap()
{

 this.aid=null;   // aid[i1][i2]: proposed similarity between the two items i1, i2.
 this.maxItems=0; // max. number of items to draw. if set to 0, dimension of aid[] is used.

 // adjustable constants ------------------------------------------------------

 // window size and scaling
 this.left             =0;     // left border of drawing area
 this.top              =0;     // top border of drawing area
 this.bottom           =0;     // bottom border, automatically detected if not set.
 this.right            =0;     // right border, automatically detected if not set.
 this.padding          =1;     // padding in px added to the boundaries. defaults to 1px to remove extends by rounding
                               // errors which would force a map restart on iOS platforms by triggering onresize
 this.offsetX          =0;     // x displace central item
 this.offsetY          =0;     // y displace central item
 this.scaleFactor      =1.4;   // scaling in respect to calculated window space
 this.scaleByCenterDist=-1;    // scaling in respect to mean target center distance (mean aid[i][0])


 // timing
 this.frameDelayInitial=25;    // initial value of increasing delay at each timestep
 this.slowdownCycle    =300;   // number of timesteps after that delay is increased

 // physics
 this.inertia          =0.7;   // part of velocity kept in one timestep 
 this.damperInitial    =1;     // initial value of increasing damper that cool down motion with time
 this.damperFactor     =1.002; // factor the damper is increased by in one timestep
 this.damperMax        =100;   // max. value of damper
 this.springForce0     =0.025; // force between each item and the central item s0 trying to keep them at aid[][]-distance
 this.springForce      =0.005; // force between each item pair except the central item s0
 this.centeringForce   =0.1;   // force that pulls the center of gravity towards the central item 

 // overlap avoiding
 this.repelDelay       =150;   // nr. of timesteps without repulsion
 this.repelIncrease    =0.01;  // amount the repelling force that keeps items non overlapping increases each timestep
 this.repelMax         =0.5;   // max amount of repelling force. 

 // ----------------------------------------------------------------------------

 items=null;                  // holds the items
 this.nrItems=null;                // number of items to layout
 var maxX, maxY, minX, minY; // bounds of drawing area
 var scaleX,scaleY;          // scale to make anything fit
 var cogX, cogY;             // center of gravity of all items
 var cycle=0;                // refresh cycle counter
 var frameDelay;             // delay between redraws
 var damper;                 // increasing damper to cool down motion
 var repel;                  // increasing force that repells items to not overlap each other

 this.limitNrItems=function()
 {
  var limit=99999; 
  if ((maxX-minX)<600) limit=30;
  if ((maxX-minX)<400) limit=20;
	if (limit>this.items.length) limit=this.items.length;
  nrItems=limit;
  for (var i=0;i<this.items.length;i++)
  {
    if (i>=nrItems) this.items[i].element.style.display="none";
    else            this.items[i].element.style.display="block";
  }
 }

 /**
  * update minX,minY,maxX,maxY to window size 
  */
 this.updateBoundaries=function()
 {
  minX=0;
  minY=0;
  maxX = document.getElementById("gnodMap").clientWidth;
  maxY = document.getElementById("gnodMap").clientHeight;
 }

 /**
  * returns the mean item dimensions (width, height)
  */
 this.getMeanItemSize=function()
 {
  var meanW=0, meanH=0;

  for (var i=1;i<nrItems;i++)
  {
   meanW+=this.items[i].width;
   meanH+=this.items[i].height;
  } 
  meanW/=nrItems;
  meanH/=nrItems;
  
  return {width: meanW, height: meanH};
 }


 /**
  * sets scaleX, scaleY in relation to window size, proposed item distance, mean item size, parameters.
  */
 this.updateScale=function()
 {
  var scale            =this.scaleFactor*(1+this.scaleByCenterDist*this.meanTargetCenterDistance());
  var meanSize         =this.getMeanItemSize();

  if (!scale) scale=0.2; // otherwise the map will collapse if there are only 2 items

  scaleX=(maxX-minX-meanSize.width )*scale;
  scaleY=(maxY-minY-meanSize.height)*scale;
 }

 /**
  * update boundaries to window size and place items at initial positions
  */
 this.resetItemPositions=function()
 {
  this.updateBoundaries();

  this.items=new Array();
  this.items[0]=new mg_2d_element(0);

  // center item0
  this.items[0].x=minX+(maxX-minX)/2;
  this.items[0].y=minY+(maxY-minY)/2;

  if (this.offsetX) this.items[0].x+=this.offsetX;
  if (this.offsetY) this.items[0].y+=this.offsetY;

  for (var i=1;i<this.aid.length;i++)
  {
   this.items[i]=new mg_2d_element(i);
   this.items[i].inertia=this.inertia;

   //initially place elements on a small circle:
   this.items[i].x=this.items[0].x+Math.sin(i);
   this.items[i].y=this.items[0].y+Math.cos(i);
  } 

	this.limitNrItems();

  this.updateScale();

  cogX=this.items[0].x;
  cogY=this.items[0].y;
  cycle=0;
  frameDelay=this.frameDelayInitial;
  damper=this.damperInitial;
  repel=0;
 }

 /**
  * recenter items by moving their center of gravity towards item[0].
  */
 this.recenterItems=function()
 {
  var forceX=(this.items[0].x-cogX)*this.centeringForce;
  var forceY=(this.items[0].y-cogY)*this.centeringForce;
  for (var i=1; i<nrItems; i++)
  {
   if(!this.items[i].fixed)
   {
    this.items[i].x+=forceX;
    this.items[i].y+=forceY;
   }
  }
 }

 /**
  * update item positions and cogX, cogY.
  *
  * first checks all items against boundaries and push them back if needed
  */
 this.updateItems=function()
 {
  cogX=0; cogY=0;

  for (var i=0; i<nrItems; i++)
  {
   var w=this.items[i].width /2;
   var h=this.items[i].height/2;
   if (this.items[i].x+w>maxX) this.items[i].x=maxX-w;
   if (this.items[i].x-w<minX) this.items[i].x=minX+w;
   if (this.items[i].y+h>maxY) this.items[i].y=maxY-h;
   if (this.items[i].y-h<minY) this.items[i].y=minY+h;

   cogX+=this.items[i].x;
   cogY+=this.items[i].y;

   this.items[i].update(damper);
  }
  cogX/=nrItems; 
  cogY/=nrItems;
 }

 /**
  * update position of all items 
  * 
  * * pull items toward target distance stored in aim[][]
  * * push items to not overlap each other.
  */
 this.layoutItems=function()
 {
  for(var i1=1; i1<nrItems; i1++)
  {
   for(var i2=0; i2<nrItems; i2++) 
   {
    if (i2==i1) continue;

    this.adjustItemDistance(this.items[i1],this.items[i2]);
    if (repel>0) repelItem(this.items[i1],this.items[i2],repel);
   }
  }
 }

 /**
  * move two items towards their proposed distance in aim[][].
  */
 this.adjustItemDistance=function(item1, item2)
 {
  var targetDistance=this.aid[item1.id][item2.id];
  if(targetDistance<=0) return;

  var dx=item1.x-item2.x;
  var dy=item1.y-item2.y;

  var forceFactor;
  if   (item2.id==0) forceFactor=this.springForce0;
  else               forceFactor=this.springForce;

  // measure distance in both axes independently in respect to window width and height
  var wdx=dx/scaleX;
  var wdy=dy/scaleY;
  var distanceInWindowSpace=Math.sqrt(wdx*wdx+wdy*wdy);
  var force=(targetDistance-distanceInWindowSpace)*forceFactor;

  item1.speedX+=dx/distanceInWindowSpace*force;
  item1.speedY+=dy/distanceInWindowSpace*force;
 }


 /**
  * do one layout step. 
  */
 this.layoutStep=function ()
 {
  this.layoutItems();
  this.recenterItems();
  this.updateItems();

  if (damper<this.damperMax)                        damper=damper*this.damperFactor;
  if (cycle>this.repelDelay && repel<this.repelMax) repel+=this.repelIncrease;
  if (cycle>this.slowdownCycle)                     frameDelay++;
  
  cycle++;
  
  // schedule next layout step
  var thisMap=this;
  setTimeout(function(){thisMap.layoutStep()},frameDelay); 
 }

 this.sum_of_squared_errors=function()
 {
  var error0=0, error=0;
  for(var i1=0; i1<nrItems; i1++)
  {
   for(var i2=i1+1; i2<nrItems; i2++) 
   {
    var targetDistance=this.aid[i1][i2];
    if(targetDistance<=0) continue;

    var dx=this.items[i1].x-this.items[i2].x;
    var dy=this.items[i1].y-this.items[i2].y;

    // measure distance in both axes independently in respect to window width and height
    var wdx=dx/scaleX;
    var wdy=dy/scaleY;
    var distanceInWindowSpace=Math.sqrt(wdx*wdx+wdy*wdy);
    var tmp=targetDistance-distanceInWindowSpace;
    error+=tmp*tmp;
    if (i1==0) error0+=tmp*tmp;
   }
  } 
  return {error: error, error0: error0};
 }

 this.meanTargetCenterDistance=function()
 {
  var r=0;

  for(i1=1; i1<nrItems; i1++) r+=this.aid[i1][0];
  r/=(nrItems-1);
  
  return r;
 }

 this.keyPress=function(event)
 {
  if (!event) event=window.event;
  if (!event.ctrlKey) return;
	var key=null;
  if (event.which) key=event.which;
  else             key=event.keyCode;
  if (key!=105) return;

  var errors=this.sum_of_squared_errors();

  var info="Infos:\n";
  info+="Cycle: "+cycle+"\n";
  info+="Mean target center distance: "+this.meanTargetCenterDistance()+"\n";
  info+="Sum of Squared Errors of all items: "+errors.error+"\n";
  info+="Sum of Squared Errors of center item: "+errors.error0+"\n";
  alert (info);
  return false;
 }

 /**
  * find needle in sorted array haystack
  */
 function search(needle, haystack) {
  var low=0;
  var high=haystack.length-1;

  while (low<=high)
  {
   var mid   = parseInt((low+high)/2);
   var value = haystack[mid];

   if      (value>needle) high=mid-1;
   else if (value<needle) low =mid+1;
   else    return mid;
  }

  return -1;
 }

 /**
  * replace values of aid[][] with equally dense values in the range 0.0-1.0
  * the smallest item becomes 1.0, the largest 0.0. 
  */
 this.equalizeAid=function()
 {
  var values=new Array();

  //build array of all used values
  for (var i=0; i<nrItems; i++)
   for (var j=0; j<nrItems; j++)
    if (this.aid[i][j]>0) values.push(this.aid[i][j]);

  values.sort();

  //assign each aid[][] the rank of its value in values[] normalized to 0.0...1.0
  for (var i=0; i<nrItems; i++)
   for (var j=0; j<nrItems; j++)
    if (this.aid[i][j]>0) 
    {
     this.aid[i][j]=1-(search(this.aid[i][j], values)/values.length);
    }
 }

 /**
  * initially place every item and start refresh timer.
  */
 this.init=function ()
 {
  // Even though init() gets called on window.onload, in IE it sometimes
  // gets started with a screen size of 0. If so, we try again later:
  this.updateBoundaries();
  if (maxX<1 || maxY<1)
  {
   var me=this;
   setTimeout(function(){me.init()},500);
   return;
  }

  nrItems=this.aid[0].length;
  if (this.maxItems && nrItems>this.maxItems) nrItems=this.maxItems;
  
  this.equalizeAid();
  this.resetItemPositions();

  setTimeout(function(){gnodMap.layoutStep()},10); // let's go.
 }

 // ----------------------------------------------------------------------------
 // install event handlers.
 //
 // instead of calling init directy, we attach it to the window.onload event
 // especially when the map is loaded, the screensize might not be set
 // before that event

 var me=this;

 document.onkeypress=function(event)
 {  
  return me.keyPress(event);
 }

 window.onresize=function()
 {
  me.resetItemPositions();
 }

 window.onload=function ()
 {
  me.init();
 }
}

gnodMap=new GnodMap(); 
