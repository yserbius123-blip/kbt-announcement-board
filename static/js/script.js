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
