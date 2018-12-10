import React, { Component } from 'react';
import { func, object, string } from 'prop-types';
import {
  DayPickerSingleDateController,
  isSameDay,
  isInclusivelyBeforeDay,
  isInclusivelyAfterDay,
} from 'react-dates';
import classNames from 'classnames';
import moment from 'moment';
import { ensureBooking, ensureAvailabilityException, ensureDayAvailabilityPlan } from '../../util/data';
import { DAYS_OF_WEEK } from '../../util/types';
import { monthIdString, dateFromLocalToAPI } from '../../util/dates';
import { IconArrowHead, IconSpinner } from '../../components';

import css from './ManageAvailabilityCalendar.css';

export const HORIZONTAL_ORIENTATION = 'horizontal';

const prevMonth = currentMoment =>
  currentMoment
    .clone()
    .subtract(1, 'months')
    .startOf('month');
const nextMonth = currentMoment =>
  currentMoment
    .clone()
    .add(1, 'months')
    .startOf('month');

const dateStartAndEndInUTC = date => {
  const start = moment(date).utc().startOf('day').toDate();
  const end = moment(date)
    .utc()
    .add(1, 'days')
    .startOf('day')
    .toDate();
  return { start, end };
};

const isPast = day => {
  const today = moment();
  return !isSameDay(day, today) && isInclusivelyBeforeDay(day, today);
};

const isBooked = (bookings, day) => {
  return !!bookings.find(b => {
    const booking = ensureBooking(b);
    const start = booking.attributes.start;
    const end = booking.attributes.end;
    const dayInUTC = day.clone().utc();

    // '[)' means that the range start is inclusive and range end exclusive
    return dayInUTC.isBetween(moment(start).utc(), moment(end).utc(), null, '[)');
  });
};

const findException = (exceptions, day) => {
  return exceptions.find(exception => {
    const availabilityException = ensureAvailabilityException(exception.availabilityException);
    const start = availabilityException.attributes.start;
    const dayInUTC = day.clone().utc();
    return isSameDay(moment(start).utc(), dayInUTC);
  });
};

const isBlocked = (availabilityPlan, exceptions, date) => {
  const planEntries = ensureDayAvailabilityPlan(availabilityPlan).entries;
  const seatsFromPlan = planEntries.find(
    weekDayEntry => weekDayEntry.dayOfWeek === DAYS_OF_WEEK[date.isoWeekday() - 1]
  ).seats;

  const exception = findException(exceptions, date);
  const seatsFromException =
    exception && ensureAvailabilityException(exception.availabilityException).attributes.seats;

  const seats = exception ? seatsFromException : seatsFromPlan;
  return seats === 0;
};

const isInProgress = (exceptions, day) => {
  const exception = findException(exceptions, day);
  return !!exception && exception.inProgress;
};

const hasError = (exceptions, day) => {
  const exception = findException(exceptions, day);
  return !!exception && exception.error;
};

const draftException = (exceptions, start, end, seats) => {
  const draft = ensureAvailabilityException({ attributes: { start, end, seats } });
  return { availabilityException: draft };
};

class ManageAvailabilityCalendar extends Component {
  constructor(props) {
    super(props);

    // DOM refs
    this.dayPickerWrapper = null;
    this.dayPicker = null;

    this.state = {
      currentMonth: moment().startOf('month'),
      focused: true,
      date: null,
    };

    this.fetchMonthData = this.fetchMonthData.bind(this);
    this.onDayAvailabilityChange = this.onDayAvailabilityChange.bind(this);
    this.onDateChange = this.onDateChange.bind(this);
    this.onFocusChange = this.onFocusChange.bind(this);
    this.onMonthClick = this.onMonthClick.bind(this);
  }

  componentDidMount() {
    this.fetchMonthData(this.state.currentMonth);
    // Fetch next month too.
    this.fetchMonthData(nextMonth(this.state.currentMonth));
  }

  fetchMonthData(monthMoment) {
    const { availability, listingId } = this.props;

    // Don't fetch exceptions for past months
    if (monthMoment.isSameOrAfter(moment(), 'month')) {
      // Use "today", if the first day of given month is in the past
      const start = isPast(monthMoment)
        ? moment()
            .startOf('day')
            .toDate()
        : monthMoment.toDate();
      const end = nextMonth(monthMoment).toDate();

      availability.onFetchAvailabilityExceptions({ listingId, start, end });

      const state = ['pending', 'accepted'].join(',');
      availability.onFetchBookings({ listingId, start, end, state })
    }
  }

  onDayAvailabilityChange(date, seats, exceptions) {
    const { availabilityPlan, listingId } = this.props;
    const { start, end } = dateStartAndEndInUTC(date);

    const planEntries = ensureDayAvailabilityPlan(availabilityPlan).entries;
    const seatsFromPlan = planEntries.find(
      weekDayEntry => weekDayEntry.dayOfWeek === DAYS_OF_WEEK[date.isoWeekday() - 1]
    ).seats;

    const currentException = findException(exceptions, date);
    const draft = draftException(exceptions, start, end, seatsFromPlan);
    const exception = currentException || draft;
    const hasAvailabilityException = currentException && currentException.availabilityException.id;

    if (hasAvailabilityException) {
      const id = currentException.availabilityException.id;
      const isResetToPlanSeats = seatsFromPlan === seats;

      if (isResetToPlanSeats) {
        this.props.availability.onDeleteAvailabilityException({ id, currentException: exception });
      } else {
        this.props.availability
          .onDeleteAvailabilityException({ id, currentException: exception })
          .then(r => {
            const params = { listingId, start, end, seats, currentException: exception };
            this.props.availability.onCreateAvailabilityException(params);
          });
      }
    } else {
      const params = { listingId, start, end, seats, currentException: exception };
      this.props.availability.onCreateAvailabilityException(params);
    }
  }

  onDateChange(date) {
    this.setState({ date });

    const { availabilityPlan, availability } = this.props;
    const calendar = availability.calendar;
    const { exceptions = [], bookings = [] } = calendar[monthIdString(date)] || {};

    if (isBooked(bookings, date) || isPast(date) || isInProgress(exceptions, date)) {
      // Cannot allow or block a reserved or a past date or inProgress
      return;
    } else if (isBlocked(availabilityPlan, exceptions, date)) {
      this.onDayAvailabilityChange(date, 1, exceptions);
    } else {
      this.onDayAvailabilityChange(date, 0, exceptions);
    }
  }

  onFocusChange() {
    // Force the focused states to always be truthy so that date is always selectable
    this.setState({ focused: true });
  }

  onMonthClick(monthFn) {
    const onMonthChanged = this.props.onMonthChanged;
    this.setState(
      prevState => ({ currentMonth: monthFn(prevState.currentMonth) }),
      () => {
        // callback
        this.fetchMonthData(monthFn(this.state.currentMonth));

        if (onMonthChanged) {
          onMonthChanged(monthIdString(this.state.currentMonth));
        }
      }
    );
  }

  render() {
    const {
      className,
      rootClassName,
      listingId,
      availability,
      availabilityPlan,
      onMonthChanged,
      ...rest
    } = this.props;
    const { focused, date } = this.state;
    const { clientWidth: width } = this.dayPickerWrapper || { clientWidth: 0 };

    const daySize = width > 744 ? 100 : width > 344 ? Math.floor((width - 44) / 7) : 42;

    const calendar = availability.calendar;

    const renderDayContents = day => {
      const { exceptions = [], bookings = [] } = calendar[monthIdString(day)] || {};

      const dayClasses = classNames(css.default, {
        [css.past]: isPast(day),
        [css.today]: isSameDay(moment(), day),
        [css.blocked]: isBlocked(availabilityPlan, exceptions, day),
        [css.reserved]: isBooked(bookings, day),
        [css.exceptionError]: hasError(exceptions, day),
      });

      return (
        <div className={css.dayWrapper}>
          <span className={dayClasses}>
            <span className={css.dayNumber}>{day.format('DD')}</span>
          </span>
          {isInProgress(exceptions, day) ? <IconSpinner rootClassName={css.inProgress} /> : null}
        </div>
      );
    };

    const classes = classNames(rootClassName || css.root, className);

    return (
      <div
        className={classes}
        ref={c => {
          this.dayPickerWrapper = c;
        }}
      >
        {width > 0 ? (
          <DayPickerSingleDateController
            {...rest}
            ref={c => {
              this.dayPicker = c;
            }}
            numberOfMonths={1}
            navPrev={<IconArrowHead direction="left" />}
            navNext={<IconArrowHead direction="right" />}
            daySize={daySize}
            renderDayContents={renderDayContents}
            focused={focused}
            date={date}
            onDateChange={this.onDateChange}
            onFocusChange={this.onFocusChange}
            onPrevMonthClick={() => this.onMonthClick(prevMonth)}
            onNextMonthClick={() => this.onMonthClick(nextMonth)}
            hideKeyboardShortcutsPanel={width < 400}
          />
        ) : null}
      </div>
    );
  }
}

ManageAvailabilityCalendar.defaultProps = {
  className: null,
  rootClassName: null,

  // day presentation and interaction related props
  renderCalendarDay: undefined,
  renderDayContents: null,
  isDayBlocked: () => false,
  isOutsideRange: day => !isInclusivelyAfterDay(day, moment()),
  isDayHighlighted: () => false,
  enableOutsideDays: true,

  // calendar presentation and interaction related props
  orientation: HORIZONTAL_ORIENTATION,
  withPortal: false,
  initialVisibleMonth: null,
  numberOfMonths: 2,
  onOutsideClick() {},
  keepOpenOnDateSelect: false,
  renderCalendarInfo: null,
  isRTL: false,

  // navigation related props
  navPrev: null,
  navNext: null,
  onPrevMonthClick() {},
  onNextMonthClick() {},

  // internationalization
  monthFormat: 'MMMM YYYY',
  onMonthChanged: null,
};

ManageAvailabilityCalendar.propTypes = {
  className: string,
  rootClassName: string,
  availability: object.isRequired,
  onMonthChanged: func,
};

export default ManageAvailabilityCalendar;
