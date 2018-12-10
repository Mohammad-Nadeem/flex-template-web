/* eslint-disable no-console */
import EditListingAvailabilityForm from './EditListingAvailabilityForm';

export const Empty = {
  component: EditListingAvailabilityForm,
  props: {
    onSubmit: values => {
      console.log('Submit EditListingAvailabilityForm with (unformatted) values:', values);
    },
    saveActionMsg: 'Save rules',
    updated: false,
    updateInProgress: false,
  },
  group: 'forms',
};
