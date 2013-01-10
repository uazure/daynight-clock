window.requestAnimFrame = function(){
    return (
        window.requestAnimationFrame       || 
        window.webkitRequestAnimationFrame || 
        window.mozRequestAnimationFrame    || 
        window.oRequestAnimationFrame      || 
        window.msRequestAnimationFrame     || 
        function(/* function */ callback){
            window.setTimeout(callback, 1000 / 1);
        }
    );
}();

var ClockClass = function(canvas, latitude, longitude, time) {
	this.longitude=longitude;
	this.latitude=latitude;
	this.time=time;
	this.canvasElement=canvas;
	this.canvas=canvas.getContext('2d');
	this.centerPoint= {
		x: canvas.width/2,
		y: canvas.height/2
	};
	console.log('center point of clock: %o', this.centerPoint);

    var clockSize=canvas.width/2-5;
    this.settings.clockRadius=clockSize;
    this.settings.hourTickRadius = clockSize*0.85;
    this.settings.hourLabelRadius = clockSize*0.925
    this.settings.minuteLabelRadius = clockSize*0.75;
    this.settings.hourPointerLength = clockSize*0.85
    this.settings.minutePointerLength = clockSize*0.7;
    this.settings.hourLabelFont = 'bold '+parseInt(clockSize/15, 10)+'px sans';
    this.settings.minuteLabelFont = 'normal '+parseInt(clockSize/20, 10)+'px sans';
    
    
    console.log('Clock object: %o', this);
    console.log('this.settings: %o', this.settings);
    
	console.log('init geolocation with longitude '+longitude+' and latitude '+latitude);
	this.geolocation=new SunriseSunset(
		time.getUTCFullYear(),
		time.getUTCMonth()+1, //+1 required for month to be in range 1..12 insted of 0..11
		time.getUTCDate(),
		latitude,
		longitude		
		);
		
	this.gmtOffset=time.getTimezoneOffset()/(-60);
	console.log('gmt offset: '+this.gmtOffset);
	
};

ClockClass.prototype = {
	//default settings for clock
	settings : {
		debug: false,
		clockRadius: 300,
		clockBodyWidth: 3,
		hourLabelRadius: 275,
		minuteLabelRadius: 200,
		hourLabelFont: "bold 25px Arial",
		minuteLabelFont: "normal 20px Arial",
		hourPointerLength: 250,
		hourPointerWidth: 8,
		minutePointerLength: 175,
		minutePointerWidth: 2,
		hourTickRadius: 250,
        hourTickLength: -20,
        hourTickLengthStrong: -30,
        hourTickLengthEmphasize: -40,
		hourTickWidth: 1,
		hourTickWidthEmphasize: 1,
		hourTickWidthStrong: 3,
		minuteTickRadius: 220,
		minuteTickLength: -10,
        minuteTickLengthStrong: -15,
        minuteTickLengthEmphasize: -20,
        minuteTickWidth: 1,
        minuteTickWidthEmphasize: 1,
        minuteTickWidthStrong: 3,
		displayNthHourTick: 1,
		displayNthHourTickStrong: 4,
		displayNthHourTickEmphasize: 2,
		displayNthMinuteTick: 10,		
		displayNthHourLabel: 1,
		displayNthMinuteLabel: 10,
		displayMinutePointer: true,
		pointerCapSize: 10
	},
	cache: {
	    isEnabled: true
	},
	render: function() {
		console.log('Clock: render()');
		this.canvas.clearRect(0,0, this.canvasElement.width, this.canvasElement.height);
		//this.renderNoCoordsAvailable();
		this.renderBody();
		this.renderPointers();
		if (this.settings.debug) {
			this.renderDebug();
		}
	},
	renderNoCoordsAvailable: function() {
	    var canvas=this.canvas;
	    var img=new Image();
	    img.src='no-coords.png';
	    img.onload=function() {
	        console.log('Image obj: %o', img);
	        canvas.drawImage(img,0,0);
	    }
	    
	},
	renderDebug: function() {
		console.log(this.time);	
	},
	renderPointers: function() {
	    //draw hour pointer
		var hourAngle=this.hourAngle(this.time);
		var point=this.toDecart(this.settings.hourPointerLength, hourAngle);
		point.x+=this.centerPoint.x;
		point.y+=this.centerPoint.y;
		
		//draw hour pointer
		//FIXME: make hour pointer looks better than just bold line :)
		this.canvas.beginPath();
		this.canvas.lineWidth=this.settings.hourPointerWidth;
		this.canvas.moveTo(this.centerPoint.x, this.centerPoint.y);
		this.canvas.lineTo(point.x, point.y);
		this.canvas.stroke();
		
		//draw minute pointer
		if (this.settings.displayMinutePointer) {
		var minuteAngle=this.minuteAngle(this.time);
            this.canvas.beginPath();
            this.canvas.lineWidth=this.settings.minutePointerWidth;
            point=this.toDecart(this.settings.minutePointerLength, minuteAngle);
            point.x+=this.centerPoint.x;
            point.y+=this.centerPoint.y;
            this.canvas.moveTo(this.centerPoint.x,this.centerPoint.y);
            this.canvas.lineTo(point.x, point.y);
            this.canvas.stroke();
		}
		
		//draw a cap in the middle of the clock
		this.canvas.beginPath();
		this.canvas.arc(this.centerPoint.x, this.centerPoint.y, this.settings.pointerCapSize, 0, 2*Math.PI);
		this.canvas.fill();
	},
	
	renderBodyNight: function(canvas) {
	    canvas.save();
        //translate center of canvas to center of the clock
        canvas.translate(this.centerPoint.x, this.centerPoint.y);
        
        //draw night sector:
        this.geolocation.mode='official'; //get sunrinse and sunset as we see it
        var sunriseHour=this.geolocation.sunriseLocalHours(this.gmtOffset);
        var sunsetHour=this.geolocation.sunsetLocalHours(this.gmtOffset);
        this.geolocation.mode='civil'; //get time when it becames dark enough
        var sunriseHour2=this.geolocation.sunriseLocalHours(this.gmtOffset);
        var sunsetHour2=this.geolocation.sunsetLocalHours(this.gmtOffset);
        //Hour2 is always the lighter day time than cooresponding Hour
        console.log('sunset, sunrise: '+sunsetHour+'..'+sunsetHour2+', '+sunriseHour+'..'+sunriseHour2);
        
        var sunsetAngle=sunsetHour/24*360/180*Math.PI;
        var sunsetAngle2=sunsetHour2/24*360/180*Math.PI;
        var sunriseAngle=sunriseHour/24*360/180*Math.PI;
        var sunriseAngle2=sunriseHour2/24*360/180*Math.PI;
        
        var sunsetPoint=this.toDecart(this.settings.clockRadius,sunsetAngle);
        var sunsetPoint2=this.toDecart(this.settings.clockRadius,sunsetAngle2);
        var sunrisePoint=this.toDecart(this.settings.clockRadius,sunriseAngle);
        var sunrisePoint2=this.toDecart(this.settings.clockRadius,sunriseAngle2);
        
        canvas.beginPath();
        canvas.moveTo(0,0);
        canvas.arc(0, 0, this.settings.clockRadius, sunsetAngle2-Math.PI/2, sunriseAngle2-Math.PI/2 );
        canvas.fillStyle='#545465';
        canvas.fill();
        
        canvas.save();
        canvas.rotate(sunriseAngle2-0.01);
        var sunriseLength=this.length(sunrisePoint, sunrisePoint2);
        console.log('Sunrise gradient len: '+sunriseLength);
        var sunriseGradient=canvas.createLinearGradient(0, 0, sunriseLength, 0);
        sunriseGradient.addColorStop(0, '#545465');
        sunriseGradient.addColorStop(1, '#ffffff');
        canvas.beginPath();
        canvas.moveTo(0,0);
        canvas.arc(0,0, this.settings.clockRadius, -Math.PI/2, -Math.PI/2+sunriseAngle-sunriseAngle2);
        canvas.fillStyle=sunriseGradient;
        canvas.fill();
        canvas.restore();
        
        canvas.save();
        canvas.rotate(sunsetAngle2+0.01);
        var sunsetLength=this.length(sunsetPoint, sunsetPoint2);
        console.log('Sunset gradient len: '+sunsetLength);
        var sunsetGradient=canvas.createLinearGradient(0, 0, -sunsetLength, 0);
        sunsetGradient.addColorStop(0, '#545465');
        sunsetGradient.addColorStop(1, '#ffffff');
        canvas.beginPath();
        canvas.moveTo(0,0);
        canvas.arc(0,0, this.settings.clockRadius, -Math.PI/2-(sunsetAngle2-sunsetAngle), -Math.PI/2);
        canvas.fillStyle=sunsetGradient;
        canvas.fill();
        
        canvas.restore();
	},
	
	renderBody: function() {
		var canvas=this.canvas;
		if (typeof this.cache.body != 'undefined' && this.cache.isEnabled) {
		    console.log('Using cached clock body');
		    canvas.putImageData(this.cache.body, 0, 0);
		    return;
		}
		this.cache.body=null;
		console.log('Rendering body');
		//render night and rise/set sectors of the clock
		this.renderBodyNight(canvas);
			
		
		canvas.beginPath();
		canvas.lineWidth=this.settings.clockBodyWidth;
		canvas.arc(0,0,this.settings.clockRadius,0,2*Math.PI);
		canvas.stroke();
		
		canvas.fillStyle='#000000';
		//draw hours on clock
		//prepare text positioning properties
		canvas.font = this.settings.hourLabelFont;
		canvas.textBaseline='middle';
		canvas.textAlign='center';
		for (var i=0; i<24; ++i) {
		    
			canvas.beginPath();
			var angle=360/24*i/180*Math.PI;
			
			//display Nth hour label
			if (i%this.settings.displayNthHourLabel===0) {
                var hourLabelPoint=this.toDecart(this.settings.hourLabelRadius, angle);
                canvas.fillText(i, hourLabelPoint.x, hourLabelPoint.y);                    
            }
            
            //display Nth hour tick
            if (i%this.settings.displayNthHourTick===0) {
                var tickLength, tickWidth;
                //try to draw strong styled tick
                if (i%this.settings.displayNthHourTickStrong===0) {
                    tickLength=this.settings.hourTickLengthStrong;
                    tickWidth=this.settings.hourTickWidthStrong;
                } else if (i%this.settings.displayNthHourTickEmphasize===0) { //try display emphasize styled tick
                    tickLength=this.settings.hourTickLengthEmphasize;
                    tickWidth=this.settings.hourTickWidthEmphasize;
                } else { //fallback to standard tick style
                    tickLength=this.settings.hourTickLength;
                    tickWidth=this.settings.hourTickWidth;
                }
            } 
			
			canvas.lineWidth=tickWidth;
			
			var startPoint=this.toDecart(this.settings.hourTickRadius, angle);
			var endPoint=this.toDecart(tickLength, angle);
			
			//draw hour tick
			canvas.moveTo(startPoint.x, startPoint.y);
			canvas.lineTo(endPoint.x+startPoint.x, endPoint.y+startPoint.y);
			canvas.stroke();
		}
		//draw minutes on clock
		if (this.settings.displayNthMinuteLabel>0) {
            canvas.font = this.settings.minuteLabelFont;
            for (var i=0; i<60; ++i) {
                if (i%this.settings.displayNthMinuteLabel===0) {
                    canvas.beginPath();
                    var angle=360/60*i/180*Math.PI;
                    var minuteLabelPoint=this.toDecart(this.settings.minuteLabelRadius, angle);
                    canvas.fillText(i, minuteLabelPoint.x, minuteLabelPoint.y);    
                }
            }
		}		
		//restore center of canvas to be at original position.
		canvas.restore();
		
		this.cache.body=canvas.getImageData(0, 0, canvas.canvas.width, canvas.canvas.height);
	},
	//helper function section
	toDecart: function (radius, angle) {
		var decart={
			x: radius*Math.sin(angle),
			y: -radius*Math.cos(angle),
		};
		return decart;
	},
	length: function(point1, point2) {
		//console.log('calculating length between points %o and %o',point1, point2);
		var squaredLength=Math.pow((point1.x-point2.x),2)+Math.pow((point1.y-point2.y),2);
		//console.log('Squared length: '+squaredLength);
		return Math.sqrt(squaredLength);	
	},
	hourAngle: function(time) {
		//alert ('type of time is '+typeof (time));
		//if (typeof (time) != )
		var minutes=time.getHours()*60+time.getMinutes();
		//degree = minutes / (24*60) / 360 / 180 * PI
		var angle=minutes/4/180*Math.PI;
		return angle;		
	},
	
	minuteAngle: function(time) {
		var seconds=time.getMinutes()*60+time.getSeconds();
		var angle=seconds/10/180*Math.PI;
		return angle;
	},
};

