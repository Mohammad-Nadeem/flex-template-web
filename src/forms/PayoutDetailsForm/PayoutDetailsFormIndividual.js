import React from 'react';
import { bool, object, string } from 'prop-types';
import { compose } from 'redux';
import { injectIntl, intlShape } from 'react-intl';

import PayoutDetailsAddress from './PayoutDetailsAddress';
import PayoutDetailsBankDetails from './PayoutDetailsBankDetails';
import PayoutDetailsPersonalDetails from './PayoutDetailsPersonalDetails';

const PayoutDetailsFormIndividualComponent = ({ fieldRenderProps }) => {
  const { disabled, form, intl, values } = fieldRenderProps;
  const { country } = values;

  return (
    <React.Fragment>
      <PayoutDetailsPersonalDetails
        intl={intl}
        disabled={disabled}
        values={values}
        country={country}
      />
      <PayoutDetailsAddress country={country} intl={intl} disabled={disabled} form={form} />
      <PayoutDetailsBankDetails country={country} disabled={disabled} />
    </React.Fragment>
  );
};

PayoutDetailsFormIndividualComponent.defaultProps = {
  className: null,
  country: null,
  createStripeAccountError: null,
  disabled: false,
  inProgress: false,
  ready: false,
  submitButtonText: null,
};

PayoutDetailsFormIndividualComponent.propTypes = {
  className: string,
  createStripeAccountError: object,
  disabled: bool,
  inProgress: bool,
  ready: bool,
  submitButtonText: string,

  // from injectIntl
  intl: intlShape.isRequired,
};

const PayoutDetailsFormIndividual = compose(injectIntl)(PayoutDetailsFormIndividualComponent);

export default PayoutDetailsFormIndividual;
