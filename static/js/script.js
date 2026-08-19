	'use strict';
	const hebLookup = ['א','ב','ג','ד','ה','ו','ז','ח','ט','י','יא','יב','יג','יד','טו','טז','יז', 'יח','יט','כ', 'כא','כב','כג','כד','כה','כו','כז','כח','כט','ל'];
	function checkTime(i) {
		if (i < 10) {i = "0" + i};  // add zero in front of numbers < 10
		return i;
	}

	function startTime() {
		const today = new Date();
		let h = today.getHours();
		let m = today.getMinutes();

		let d = today.getDate();
		let M = today.toLocaleString('default', { month: 'long' });
		let Y = today.getFullYear();

		const ampm = h >= 12 ? "PM" : "AM";
		
		h = h % 12;
		if (h === 0) {
			h = 12;
		}

		let hebdate = new hebcal.HDate(today)
		let hebday = hebLookup[hebdate.getDate()];
		let hebmonth = hebcal.Locale.gettext(hebdate.getMonthName(), "he");
		let hebyear = hebdate.getFullYear();
		console.debug(hebdate.render("he"))
		m = checkTime(m);
		document.getElementById('time').innerHTML =  h + ":" + m + '<span class="ampm">' + ampm + '</span>';
		document.getElementById('en-date').innerHTML = M + " " + d + ", " + Y;
		document.getElementById('he-date').innerHTML = hebday + "'" + " " + hebmonth + " " + hebyear;
		setTimeout(startTime, 1000);
	}

	function renderTemplate(data){
		let weekday_data = data.filter(page => page.type==="daily")[0];
		let template_text = document.getElementById("weekday-schedule-template").innerHTML;
		let template = Handlebars.compile(template_text);
		//document.getElementById("schedule-template").innerHTML = "";
		document.getElementById("weekday-schedule-template").innerHTML = "";		
		document.getElementById("weekday-schedule-template").innerHTML = template(weekday_data);
	}

	function loadData() {
		fetch("/api/pages")
			.then(function (res) {
				if (!res.ok) {
					throw new Error('Request failed: ' + res.status);
				}
				return res.json();
			})
			.then(function (json) {
				renderTemplate(json);
			})
			.catch(function (err) {
				console.error('Failed to load items', err);
			});
	}
	
