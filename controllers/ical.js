const config = require('../config.js');
const express = require('express');
const router = express.Router();
const ical = require('ical-generator');
const Semester = require('../models/Semester.js');
const Schedule = require('../models/Schedule.js');

const DAYS = ['su', 'mo', 'tu', 'we', 'th', 'fr', 'sa'];

// get iCal .ics file
router.get('/:fileName', function(req, res) {
  const fileName = req.params.fileName;

  // not a valid file
  if (!fileName.endsWith('.ics')) {
    res.sendStatus(404);
    return;
  }

  const scheduleId = fileName.slice(0, -4);

  Schedule.findById(scheduleId).getFullAndExec().then(function(schedule) {
    if (!schedule) {
      res.sendStatus(404);
      return;
    }

    return Semester.findById(schedule.semester)
      .getFullAndExec()
      .then(function(semester) {
        if (!semester) {
          res.sendStatus(404);
          return;
        }

        const semesterStart = new Date(semester.startDate);
        const semesterEnd = new Date(semester.endDate);

        const cal = ical({
          name: `precourser | ${schedule.name}`,
          domain: `${config.host}`,
          prodId: {
            company: 'precourser',
            product: 'Calendar Schedule',
            language: 'EN'
          },
          timezone: 'US/Eastern',
          url: `${config.host}/ical/${fileName}`,
          ttl: 60 * 20 // 20 minutes
        });

        const courses = schedule.courses;
        const selectedSections = schedule.sections;
        for (let i = 0; i < courses.length; i++) {
          const course = courses[i];
          const sections = course.sections;

          for (let j = 0; j < sections.length; j++) {
            const section = sections[j];
            if (selectedSections.indexOf(section._id) === -1) continue;

            const meetings = section.meetings;

            for (let k = 0; k < meetings.length; k++) {
              const meeting = meetings[k];

              const start = new Date(semesterStart);
              const dayOffset = (7 + meeting.days[0] - start.getDay()) % 7;
              start.setDate(start.getDate() + dayOffset);
              start.setUTCHours(meeting.startTime / 60);
              start.setMinutes(meeting.startTime % 60, 0, 0);

              const end = new Date(start);
              end.setUTCHours(meeting.endTime / 60);
              end.setMinutes(meeting.endTime % 60, 0, 0);

              cal.createEvent({
                id: `${section._id}_${k}`,
                start: start,
                end: end,
                summary: `${course.department}${course.catalogNumber} ${section.name}`,
                location: `${meeting.building} ${meeting.room}, Princeton, NJ`,
                timezone: 'US/Eastern',
                repeating: {
                  freq: 'WEEKLY',
                  until: semesterEnd,
                  byDay: meeting.days.map(d => DAYS[d])
                }
              });
            }
          }
        }

        res.send(cal.toString());
      });
  });
});

module.exports.router = router;