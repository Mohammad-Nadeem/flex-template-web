import omit from 'lodash/omit';
import { types as sdkTypes } from '../../util/sdkLoader';
import { denormalisedResponseEntities, ensureAvailabilityException } from '../../util/data';
import { monthIdString, localDateToUTCStartOfDay } from '../../util/dates';
import { storableError } from '../../util/errors';
import { addMarketplaceEntities } from '../../ducks/marketplaceData.duck';
import * as log from '../../util/log';

const { UUID } = sdkTypes;

const isDate = d => d && typeof d.getMonth === 'function';
const isSameDate = (a, b) => a && isDate(a) && b && isDate(b) && a.getTime() === b.getTime();

const removeException = (exception, calendar) => {
  const availabilityException = ensureAvailabilityException(exception.availabilityException);
  const { start, end } = availabilityException.attributes;
  const monthId = monthIdString(start);
  const monthData = calendar[monthId] || { exceptions: [] };

  const exceptions = monthData.exceptions.filter(e => {
    const aException = ensureAvailabilityException(e.availabilityException);
    const exceptionStart = aException.attributes.start;
    const exceptionEnd = aException.attributes.end;

    return !(isSameDate(exceptionStart, start) && isSameDate(exceptionEnd, end));
  });

  return {
    ...calendar,
    [monthId]: { ...monthData, exceptions },
  };
};

const addException = (exception, calendar) => {
  const { start } = ensureAvailabilityException(exception.availabilityException).attributes;
  const monthId = monthIdString(start);
  const cleanCalendar = removeException(exception, calendar);
  const monthData = cleanCalendar[monthId] || { exceptions: [] };

  return {
    ...cleanCalendar,
    [monthId]: { ...monthData, exceptions: [...monthData.exceptions, exception] },
  };
};

const updateException = (exception, calendar) => {
  const newAvailabilityException = ensureAvailabilityException(exception.availabilityException);
  const { start, end } = newAvailabilityException.attributes;
  const monthId = monthIdString(start);
  const monthData = calendar[monthId] || { exceptions: [] };

  const exceptions = monthData.exceptions.map(e => {
    const availabilityException = ensureAvailabilityException(e.availabilityException);
    const exceptionStart = availabilityException.attributes.start;
    const exceptionEnd = availabilityException.attributes.end;

    return isSameDate(exceptionStart, start) && isSameDate(exceptionEnd, end) ? exception : e;
  });

  return {
    ...calendar,
    [monthId]: { ...monthData, exceptions },
  };
};

const requestAction = actionType => params => ({ type: actionType, payload: { params } });

const successAction = actionType => result => ({ type: actionType, payload: result.data });

const errorAction = actionType => error => ({ type: actionType, payload: error, error: true });

// ================ Action types ================ //

export const MARK_TAB_UPDATED = 'app/EditListingPage/MARK_TAB_UPDATED';
export const CLEAR_UPDATED_TAB = 'app/EditListingPage/CLEAR_UPDATED_TAB';

export const CREATE_LISTING_DRAFT_REQUEST = 'app/EditListingPage/CREATE_LISTING_DRAFT_REQUEST';
export const CREATE_LISTING_DRAFT_SUCCESS = 'app/EditListingPage/CREATE_LISTING_DRAFT_SUCCESS';
export const CREATE_LISTING_DRAFT_ERROR = 'app/EditListingPage/CREATE_LISTING_DRAFT_ERROR';

export const PUBLISH_LISTING_REQUEST = 'app/EditListingPage/PUBLISH_LISTING_REQUEST';
export const PUBLISH_LISTING_SUCCESS = 'app/EditListingPage/PUBLISH_LISTING_SUCCESS';
export const PUBLISH_LISTING_ERROR = 'app/EditListingPage/PUBLISH_LISTING_ERROR';

export const UPDATE_LISTING_REQUEST = 'app/EditListingPage/UPDATE_LISTING_REQUEST';
export const UPDATE_LISTING_SUCCESS = 'app/EditListingPage/UPDATE_LISTING_SUCCESS';
export const UPDATE_LISTING_ERROR = 'app/EditListingPage/UPDATE_LISTING_ERROR';

export const SHOW_LISTINGS_REQUEST = 'app/EditListingPage/SHOW_LISTINGS_REQUEST';
export const SHOW_LISTINGS_SUCCESS = 'app/EditListingPage/SHOW_LISTINGS_SUCCESS';
export const SHOW_LISTINGS_ERROR = 'app/EditListingPage/SHOW_LISTINGS_ERROR';

export const FETCH_BOOKINGS_REQUEST = 'app/EditListingPage/FETCH_BOOKINGS_REQUEST';
export const FETCH_BOOKINGS_SUCCESS = 'app/EditListingPage/FETCH_BOOKINGS_SUCCESS';
export const FETCH_BOOKINGS_ERROR = 'app/EditListingPage/FETCH_BOOKINGS_ERROR';

export const FETCH_EXCEPTIONS_REQUEST = 'app/EditListingPage/FETCH_AVAILABILITY_EXCEPTIONS_REQUEST';
export const FETCH_EXCEPTIONS_SUCCESS = 'app/EditListingPage/FETCH_AVAILABILITY_EXCEPTIONS_SUCCESS';
export const FETCH_EXCEPTIONS_ERROR = 'app/EditListingPage/FETCH_AVAILABILITY_EXCEPTIONS_ERROR';

export const CREATE_EXCEPTION_REQUEST = 'app/EditListingPage/CREATE_AVAILABILITY_EXCEPTION_REQUEST';
export const CREATE_EXCEPTION_SUCCESS = 'app/EditListingPage/CREATE_AVAILABILITY_EXCEPTION_SUCCESS';
export const CREATE_EXCEPTION_ERROR = 'app/EditListingPage/CREATE_AVAILABILITY_EXCEPTION_ERROR';

export const DELETE_EXCEPTION_REQUEST = 'app/EditListingPage/DELETE_AVAILABILITY_EXCEPTION_REQUEST';
export const DELETE_EXCEPTION_SUCCESS = 'app/EditListingPage/DELETE_AVAILABILITY_EXCEPTION_SUCCESS';
export const DELETE_EXCEPTION_ERROR = 'app/EditListingPage/DELETE_AVAILABILITY_EXCEPTION_ERROR';

export const UPLOAD_IMAGE_REQUEST = 'app/EditListingPage/UPLOAD_IMAGE_REQUEST';
export const UPLOAD_IMAGE_SUCCESS = 'app/EditListingPage/UPLOAD_IMAGE_SUCCESS';
export const UPLOAD_IMAGE_ERROR = 'app/EditListingPage/UPLOAD_IMAGE_ERROR';

export const UPDATE_IMAGE_ORDER = 'app/EditListingPage/UPDATE_IMAGE_ORDER';

export const REMOVE_LISTING_IMAGE = 'app/EditListingPage/REMOVE_LISTING_IMAGE';

// ================ Reducer ================ //

const initialState = {
  // Error instance placeholders for each endpoint
  createListingDraftError: null,
  publishingListing: null,
  publishListingError: null,
  updateListingError: null,
  showListingsError: null,
  uploadImageError: null,
  createListingDraftInProgress: false,
  submittedListingId: null,
  redirectToListing: false,
  availabilityCalendar: {
    // '2018-12': {
    //   bookings: [],
    //   exceptions: [],
    //   fetchError: null,
    //   fetchInProgress: false,
    //   fetchBookingsError: null,
    //   fetchBookingsInProgress: false,
    // },
  },
  availabilityCalendarErrors: [], // REMOVE

  images: {},
  imageOrder: [],
  removedImageIds: [],
  listingDraft: null,
  updatedTab: null,
  updateInProgress: false,
};

export default function reducer(state = initialState, action = {}) {
  const { type, payload } = action;
  switch (type) {
    case MARK_TAB_UPDATED:
      return { ...state, updatedTab: payload };
    case CLEAR_UPDATED_TAB:
      return { ...state, updatedTab: null, updateListingError: null };

    case CREATE_LISTING_DRAFT_REQUEST:
      return {
        ...state,
        createListingDraftInProgress: true,
        createListingDraftError: null,
        submittedListingId: null,
        listingDraft: null,
      };

    case CREATE_LISTING_DRAFT_SUCCESS:
      return {
        ...state,
        createListingDraftInProgress: false,
        submittedListingId: payload.data.id,
        listingDraft: payload.data,
      };
    case CREATE_LISTING_DRAFT_ERROR:
      return {
        ...state,
        createListingDraftInProgress: false,
        createListingDraftError: payload,
      };

    case PUBLISH_LISTING_REQUEST:
      return {
        ...state,
        publishingListing: payload.listingId,
        publishListingError: null,
      };
    case PUBLISH_LISTING_SUCCESS:
      return {
        redirectToListing: true,
        publishingListing: null,
      };
    case PUBLISH_LISTING_ERROR: {
      // eslint-disable-next-line no-console
      console.error(payload);
      return {
        ...state,
        publishingListing: null,
        publishListingError: {
          listingId: state.publishingListing,
          error: payload,
        },
      };
    }

    case UPDATE_LISTING_REQUEST:
      return { ...state, updateInProgress: true, updateListingError: null };
    case UPDATE_LISTING_SUCCESS:
      return { ...state, updateInProgress: false };
    case UPDATE_LISTING_ERROR:
      return { ...state, updateInProgress: false, updateListingError: payload };

    case SHOW_LISTINGS_REQUEST:
      return { ...state, showListingsError: null };
    case SHOW_LISTINGS_SUCCESS:
      return { ...initialState, availabilityCalendar: { ...state.availabilityCalendar } };

    case SHOW_LISTINGS_ERROR:
      // eslint-disable-next-line no-console
      console.error(payload);
      return { ...state, showListingsError: payload, redirectToListing: false };

    case FETCH_BOOKINGS_REQUEST:
      return {
        ...state,
        availabilityCalendar: {
          ...state.availabilityCalendar,
          [payload.monthId]: {
            ...state.availabilityCalendar[payload.monthId],
            fetchBookingsError: null,
            fetchBookingsInProgress: true,
          },
        },
      };
    case FETCH_BOOKINGS_SUCCESS:
      return {
        ...state,
        availabilityCalendar: {
          ...state.availabilityCalendar,
          [payload.monthId]: {
            ...state.availabilityCalendar[payload.monthId],
            bookings: payload.bookings,
            fetchBookingsInProgress: false,
          },
        },
      };
    case FETCH_BOOKINGS_ERROR:
      return {
        ...state,
        availabilityCalendar: {
          ...state.availabilityCalendar,
          [payload.monthId]: {
            ...state.availabilityCalendar[payload.monthId],
            fetchBookingsError: payload.error,
            fetchBookingsInProgress: false,
          },
        },
      };

    case FETCH_EXCEPTIONS_REQUEST:
      return {
        ...state,
        availabilityCalendar: {
          ...state.availabilityCalendar,
          [payload.monthId]: {
            ...state.availabilityCalendar[payload.monthId],
            fetchError: null,
            fetchInProgress: true,
          },
        },
      };
    case FETCH_EXCEPTIONS_SUCCESS:
      return {
        ...state,
        availabilityCalendar: {
          ...state.availabilityCalendar,
          [payload.monthId]: {
            ...state.availabilityCalendar[payload.monthId],
            exceptions: payload.exceptions,
            fetchInProgress: false,
          },
        },
      };
    case FETCH_EXCEPTIONS_ERROR:
      return {
        ...state,
        availabilityCalendar: {
          ...state.availabilityCalendar,
          [payload.monthId]: {
            ...state.availabilityCalendar[payload.monthId],
            fetchError: payload.error,
            fetchInProgress: false,
          },
        },
      };

    case CREATE_EXCEPTION_REQUEST: {
      const { start, end, seats } = payload.params;
      const draft = ensureAvailabilityException({ attributes: { start, end, seats } });
      const exception = { availabilityException: draft, inProgress: true };
      const cleanCalendar = removeException(exception, state.availabilityCalendar);

      return {
        ...state,
        availabilityCalendar: addException(exception, cleanCalendar),
      };
    }

    case CREATE_EXCEPTION_SUCCESS:
      return {
        ...state,
        availabilityCalendar: updateException(payload.exception, state.availabilityCalendar), //{ ...state.availabilityCalendar, [monthId]: monthDataNew },
      };

    case CREATE_EXCEPTION_ERROR: {
      const { availabilityException, error } = payload;
      const failedException = { availabilityException, error };
      return {
        ...state,
        availabilityCalendar: updateException(failedException, state.availabilityCalendar), // { ...state.availabilityCalendar, [monthId]: monthDataNew },
      };
    }

    case DELETE_EXCEPTION_REQUEST: {
      const { id, currentException } = payload.params;
      const exception = { ...omit(currentException, ['error']), id, inProgress: true };

      return {
        ...state,
        availabilityCalendar: updateException(exception, state.availabilityCalendar),
      };
    }

    case DELETE_EXCEPTION_SUCCESS:
      return {
        ...state,
        availabilityCalendar: removeException(payload.exception, state.availabilityCalendar),
      };

    case DELETE_EXCEPTION_ERROR: {
      const { availabilityException, error } = payload;
      const failedException = { availabilityException, error };
      return {
        ...state,
        availabilityCalendar: updateException(failedException, state.availabilityCalendar),
      };
    }

    case UPLOAD_IMAGE_REQUEST: {
      // payload.params: { id: 'tempId', file }
      const images = {
        ...state.images,
        [payload.params.id]: { ...payload.params },
      };
      return {
        ...state,
        images,
        imageOrder: state.imageOrder.concat([payload.params.id]),
        uploadImageError: null,
      };
    }
    case UPLOAD_IMAGE_SUCCESS: {
      // payload.params: { id: 'tempId', imageId: 'some-real-id'}
      const { id, imageId } = payload;
      const file = state.images[id].file;
      const images = { ...state.images, [id]: { id, imageId, file } };
      return { ...state, images };
    }
    case UPLOAD_IMAGE_ERROR: {
      // eslint-disable-next-line no-console
      const { id, error } = payload;
      const imageOrder = state.imageOrder.filter(i => i !== id);
      const images = omit(state.images, id);
      return { ...state, imageOrder, images, uploadImageError: error };
    }
    case UPDATE_IMAGE_ORDER:
      return { ...state, imageOrder: payload.imageOrder };

    case REMOVE_LISTING_IMAGE: {
      const id = payload.imageId;

      // Only mark the image removed if it hasn't been added to the
      // listing already
      const removedImageIds = state.images[id]
        ? state.removedImageIds
        : state.removedImageIds.concat(id);

      // Always remove from the draft since it might be a new image to
      // an existing listing.
      const images = omit(state.images, id);
      const imageOrder = state.imageOrder.filter(i => i !== id);

      return { ...state, images, imageOrder, removedImageIds };
    }

    default:
      return state;
  }
}

// ================ Selectors ================ //

// ================ Action creators ================ //

export const markTabUpdated = tab => ({
  type: MARK_TAB_UPDATED,
  payload: tab,
});

export const clearUpdatedTab = () => ({
  type: CLEAR_UPDATED_TAB,
});

export const updateImageOrder = imageOrder => ({
  type: UPDATE_IMAGE_ORDER,
  payload: { imageOrder },
});

export const removeListingImage = imageId => ({
  type: REMOVE_LISTING_IMAGE,
  payload: { imageId },
});

// All the action creators that don't have the {Success, Error} suffix
// take the params object that the corresponding SDK endpoint method
// expects.

// SDK method: ownListings.create
export const createListingDraft = requestAction(CREATE_LISTING_DRAFT_REQUEST);
export const createListingDraftSuccess = successAction(CREATE_LISTING_DRAFT_SUCCESS);
export const createListingDraftError = errorAction(CREATE_LISTING_DRAFT_ERROR);

// SDK method: ownListings.publish
export const publishListing = requestAction(PUBLISH_LISTING_REQUEST);
export const publishListingSuccess = successAction(PUBLISH_LISTING_SUCCESS);
export const publishListingError = errorAction(PUBLISH_LISTING_ERROR);

// SDK method: ownListings.update
export const updateListing = requestAction(UPDATE_LISTING_REQUEST);
export const updateListingSuccess = successAction(UPDATE_LISTING_SUCCESS);
export const updateListingError = errorAction(UPDATE_LISTING_ERROR);

// SDK method: ownListings.show
export const showListings = requestAction(SHOW_LISTINGS_REQUEST);
export const showListingsSuccess = successAction(SHOW_LISTINGS_SUCCESS);
export const showListingsError = errorAction(SHOW_LISTINGS_ERROR);

// SDK method: images.upload
export const uploadImage = requestAction(UPLOAD_IMAGE_REQUEST);
export const uploadImageSuccess = successAction(UPLOAD_IMAGE_SUCCESS);
export const uploadImageError = errorAction(UPLOAD_IMAGE_ERROR);

// SDK method: bookings.query
export const fetchBookingsRequest = requestAction(FETCH_BOOKINGS_REQUEST);
export const fetchBookingsSuccess = successAction(FETCH_BOOKINGS_SUCCESS);
export const fetchBookingsError = errorAction(FETCH_BOOKINGS_ERROR);

// SDK method: availabilityExceptions.query
export const fetchAvailabilityExceptionsRequest = requestAction(FETCH_EXCEPTIONS_REQUEST);
export const fetchAvailabilityExceptionsSuccess = successAction(FETCH_EXCEPTIONS_SUCCESS);
export const fetchAvailabilityExceptionsError = errorAction(FETCH_EXCEPTIONS_ERROR);

// SDK method: availabilityExceptions.create
export const createAvailabilityExceptionRequest = requestAction(CREATE_EXCEPTION_REQUEST);
export const createAvailabilityExceptionSuccess = successAction(CREATE_EXCEPTION_SUCCESS);
export const createAvailabilityExceptionError = errorAction(CREATE_EXCEPTION_ERROR);

// SDK method: availabilityExceptions.delete
export const deleteAvailabilityExceptionRequest = requestAction(DELETE_EXCEPTION_REQUEST);
export const deleteAvailabilityExceptionSuccess = successAction(DELETE_EXCEPTION_SUCCESS);
export const deleteAvailabilityExceptionError = errorAction(DELETE_EXCEPTION_ERROR);

// ================ Thunk ================ //

export function requestShowListing(actionPayload) {
  return (dispatch, getState, sdk) => {
    dispatch(showListings(actionPayload));
    return sdk.ownListings
      .show(actionPayload)
      .then(response => {
        // EditListingPage fetches new listing data, which also needs to be added to global data
        dispatch(addMarketplaceEntities(response));
        // In case of success, we'll clear state.EditListingPage (user will be redirected away)
        dispatch(showListingsSuccess(response));
        return response;
      })
      .catch(e => dispatch(showListingsError(storableError(e))));
  };
}

export function requestCreateListingDraft(data) {
  return (dispatch, getState, sdk) => {
    dispatch(createListingDraft(data));

    const queryParams = {
      expand: true,
      include: ['author', 'images'],
      'fields.image': ['variants.landscape-crop', 'variants.landscape-crop2x'],
    };

    return sdk.ownListings
      .createDraft(data, queryParams)
      .then(response => {
        //const id = response.data.data.id.uuid;

        // Add the created listing to the marketplace data
        dispatch(addMarketplaceEntities(response));

        // Modify store to understand that we have created listing and can redirect away
        dispatch(createListingDraftSuccess(response));
        return response;
      })
      .catch(e => {
        log.error(e, 'create-listing-draft-failed', { listingData: data });
        return dispatch(createListingDraftError(storableError(e)));
      });
  };
}

export const requestPublishListingDraft = listingId => (dispatch, getState, sdk) => {
  dispatch(publishListing(listingId));

  return sdk.ownListings
    .publishDraft({ id: listingId }, { expand: true })
    .then(response => {
      // Add the created listing to the marketplace data
      dispatch(addMarketplaceEntities(response));
      dispatch(publishListingSuccess(response));
      return response;
    })
    .catch(e => {
      dispatch(publishListingError(storableError(e)));
    });
};

// Images return imageId which we need to map with previously generated temporary id
export function requestImageUpload(actionPayload) {
  return (dispatch, getState, sdk) => {
    const id = actionPayload.id;
    dispatch(uploadImage(actionPayload));
    return sdk.images
      .upload({ image: actionPayload.file })
      .then(resp => dispatch(uploadImageSuccess({ data: { id, imageId: resp.data.data.id } })))
      .catch(e => dispatch(uploadImageError({ id, error: storableError(e) })));
  };
}

export const requestFetchBookings = fetchParams => (dispatch, getState, sdk) => {
  dispatch(fetchBookingsRequest(fetchParams));

  const { listingId, start, end } = fetchParams;
  const monthId = monthIdString(start);

  return sdk.bookings
    .query({ listingId, start, end }, { expand: true })
    .then(response => {
      const bookings = denormalisedResponseEntities(response);
      return dispatch(fetchBookingsSuccess({ data: { monthId, bookings } }));
    })
    .catch(e => {
      return dispatch(fetchBookingsError({ monthId, error: storableError(e) }));
    });
};

export const requestFetchAvailabilityExceptions = fetchParams => (dispatch, getState, sdk) => {
  dispatch(fetchAvailabilityExceptionsRequest(fetchParams));

  const { listingId, start, end } = fetchParams;
  const monthId = monthIdString(start);

  return sdk.availabilityExceptions
    .query({ listingId, start, end }, { expand: true })
    .then(response => {
      const exceptions = denormalisedResponseEntities(response).map(availabilityException => ({
        availabilityException,
      }));
      return dispatch(fetchAvailabilityExceptionsSuccess({ data: { monthId, exceptions } }));
    })
    .catch(e => {
      return dispatch(fetchAvailabilityExceptionsError({ monthId, error: storableError(e) }));
    });
};

export const requestCreateAvailabilityException = params => (dispatch, getState, sdk) => {
  const { currentException, ...createParams } = params;

  dispatch(createAvailabilityExceptionRequest(createParams));

  return sdk.availabilityExceptions
    .create(createParams, { expand: true })
    .then(response => {
      dispatch(
        createAvailabilityExceptionSuccess({
          data: {
            exception: {
              availabilityException: response.data.data,
            },
          },
        })
      );
      return response;
    })
    .catch(error => {
      const availabilityException = currentException && currentException.availabilityException;
      return dispatch(
        createAvailabilityExceptionError({
          error: storableError(error),
          availabilityException,
        })
      );
    });
};

export const requestDeleteAvailabilityException = params => (dispatch, getState, sdk) => {
  const { currentException, ...deleteParams } = params;

  dispatch(deleteAvailabilityExceptionRequest(params));

  return sdk.availabilityExceptions
    .delete(deleteParams, { expand: true })
    .then(response => {
      dispatch(
        deleteAvailabilityExceptionSuccess({
          data: {
            exception: currentException,
          },
        })
      );
      return response;
    })
    .catch(error => {
      const availabilityException = currentException && currentException.availabilityException;
      return dispatch(
        deleteAvailabilityExceptionError({
          error: storableError(error),
          availabilityException,
        })
      );
    });
};

// Update the given tab of the wizard with the given data. This saves
// the data to the listing, and marks the tab updated so the UI can
// display the state.
export function requestUpdateListing(tab, data) {
  return (dispatch, getState, sdk) => {
    dispatch(updateListing(data));
    const { id } = data;
    let updateResponse;
    return sdk.ownListings
      .update(data)
      .then(response => {
        updateResponse = response;
        const payload = {
          id,
          include: ['author', 'images'],
          'fields.image': ['variants.landscape-crop', 'variants.landscape-crop2x'],
        };
        return dispatch(requestShowListing(payload));
      })
      .then(() => {
        dispatch(markTabUpdated(tab));
        dispatch(updateListingSuccess(updateResponse));
        return updateResponse;
      })
      .catch(e => {
        log.error(e, 'update-listing-failed', { listingData: data });
        return dispatch(updateListingError(storableError(e)));
      });
  };
}

// loadData is run for each tab of the wizard. When editing an
// existing listing, the listing must be fetched first.
export function loadData(params) {
  return dispatch => {
    dispatch(clearUpdatedTab());
    const { id, type } = params;
    if (type === 'new') {
      // No need to fetch anything when creating a new listing
      return Promise.resolve(null);
    }
    const payload = {
      id: new UUID(id),
      include: ['author', 'images'],
      'fields.image': ['variants.landscape-crop', 'variants.landscape-crop2x'],
    };
    return dispatch(requestShowListing(payload));
  };
}
