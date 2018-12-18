import React from 'react';
import { bool, object, string } from 'prop-types';
import { compose } from 'redux';
import { FormattedMessage, injectIntl, intlShape } from 'react-intl';
import config from '../../config';
import {
  StripeBankAccountTokenInputField,
  FieldSelect,
  FieldBirthdayInput,
  FieldTextInput,
} from '../../components';
import * as validators from '../../util/validators';

import PayoutDetailsAddress from './PayoutDetailsAddress';
import css from './PayoutDetailsForm.css';

const MIN_STRIPE_ACCOUNT_AGE = 18;

const supportedCountries = config.stripe.supportedCountries.map(c => c.code);

export const stripeCountryConfigs = countryCode => {
  const country = config.stripe.supportedCountries.find(c => c.code === countryCode);

  if (!country) {
    throw new Error(`Country code not found in Stripe config ${countryCode}`);
  }
  return country;
};

const countryCurrency = countryCode => {
  const country = stripeCountryConfigs(countryCode);
  return country.currency;
};

const PayoutDetailsFormIndividualComponent = ({ fieldRenderProps }) => {
  const {
    disabled,
    form,
    intl,
    values,
  } = fieldRenderProps;
  const { country } = values;

  const firstNameLabel = intl.formatMessage({ id: 'PayoutDetailsForm.firstNameLabel' });
  const firstNamePlaceholder = intl.formatMessage({
    id: 'PayoutDetailsForm.firstNamePlaceholder',
  });
  const firstNameRequired = validators.required(
    intl.formatMessage({
      id: 'PayoutDetailsForm.firstNameRequired',
    })
  );

  const lastNameLabel = intl.formatMessage({ id: 'PayoutDetailsForm.lastNameLabel' });
  const lastNamePlaceholder = intl.formatMessage({
    id: 'PayoutDetailsForm.lastNamePlaceholder',
  });
  const lastNameRequired = validators.required(
    intl.formatMessage({
      id: 'PayoutDetailsForm.lastNameRequired',
    })
  );

  const birthdayLabel = intl.formatMessage({ id: 'PayoutDetailsForm.birthdayLabel' });
  const birthdayLabelMonth = intl.formatMessage({
    id: 'PayoutDetailsForm.birthdayLabelMonth',
  });
  const birthdayLabelYear = intl.formatMessage({ id: 'PayoutDetailsForm.birthdayLabelYear' });
  const birthdayRequired = validators.required(
    intl.formatMessage({
      id: 'PayoutDetailsForm.birthdayRequired',
    })
  );
  const birthdayMinAge = validators.ageAtLeast(
    intl.formatMessage(
      {
        id: 'PayoutDetailsForm.birthdayMinAge',
      },
      {
        minAge: MIN_STRIPE_ACCOUNT_AGE,
      }
    ),
    MIN_STRIPE_ACCOUNT_AGE
  );

  const countryLabel = intl.formatMessage({ id: 'PayoutDetailsForm.countryLabel' });
  const countryPlaceholder = intl.formatMessage({
    id: 'PayoutDetailsForm.countryPlaceholder',
  });
  const countryRequired = validators.required(
    intl.formatMessage({
      id: 'PayoutDetailsForm.countryRequired',
    })
  );

  // StripeBankAccountTokenInputField handles the error messages
  // internally, we just have to make sure we require a valid token
  // out of the field. Therefore the empty validation message.
  const bankAccountRequired = validators.required(' ');

  const showPersonalIdNumber =
    (country && stripeCountryConfigs(country).personalIdNumberRequired) ||
    (country && stripeCountryConfigs(country).ssnLast4Required);

  const personalIdNumberRequired = validators.required(
    intl.formatMessage({
      id: `PayoutDetailsForm.personalIdNumberRequired`,
    })
  );

  let personalIdNumberLabel = null;
  let personalIdNumberPlaceholder = null;
  let personalIdNumberValid = personalIdNumberRequired;

  if (country === 'US') {
    personalIdNumberLabel = intl.formatMessage({
      id: `PayoutDetailsForm.personalIdNumberLabel.US`,
    });
    personalIdNumberPlaceholder = intl.formatMessage({
      id: `PayoutDetailsForm.personalIdNumberPlaceholder.US`,
    });

    const validSSN = validators.validSsnLast4(
      intl.formatMessage({
        id: `PayoutDetailsForm.personalIdNumberValid`,
      })
    );
    personalIdNumberValid = validators.composeValidators(personalIdNumberRequired, validSSN);
  } else if (country === 'HK') {
    personalIdNumberLabel = intl.formatMessage({
      id: `PayoutDetailsForm.personalIdNumberLabel.HK`,
    });
    personalIdNumberPlaceholder = intl.formatMessage({
      id: `PayoutDetailsForm.personalIdNumberPlaceholder.HK`,
    });
    const validHKID = validators.validHKID(
      intl.formatMessage({
        id: `PayoutDetailsForm.personalIdNumberValid`,
      })
    );
    personalIdNumberValid = validators.composeValidators(personalIdNumberRequired, validHKID);
  }

  return (
    <React.Fragment>
      <div className={css.sectionContainer}>
        <h3 className={css.subTitle}>
          <FormattedMessage id="PayoutDetailsForm.personalDetailsTitle" />
        </h3>
        <div className={css.formRow}>
          <FieldTextInput
            id="fname"
            name="fname"
            disabled={disabled}
            className={css.firstName}
            type="text"
            autoComplete="given-name"
            label={firstNameLabel}
            placeholder={firstNamePlaceholder}
            validate={firstNameRequired}
          />
          <FieldTextInput
            id="lname"
            name="lname"
            disabled={disabled}
            className={css.lastName}
            type="text"
            autoComplete="family-name"
            label={lastNameLabel}
            placeholder={lastNamePlaceholder}
            validate={lastNameRequired}
          />
        </div>
        <FieldBirthdayInput
          id="birthDate"
          name="birthDate"
          disabled={disabled}
          className={css.field}
          label={birthdayLabel}
          labelForMonth={birthdayLabelMonth}
          labelForYear={birthdayLabelYear}
          format={null}
          valueFromForm={values.birthDate}
          validate={validators.composeValidators(birthdayRequired, birthdayMinAge)}
        />
      </div>

      <div className={css.sectionContainer}>
        <h3 className={css.subTitle}>
          <FormattedMessage id="PayoutDetailsForm.addressTitle" />
        </h3>
        <FieldSelect
          id="country"
          name="country"
          disabled={disabled}
          className={css.selectCountry}
          autoComplete="country"
          label={countryLabel}
          validate={countryRequired}
        >
          <option disabled value="">
            {countryPlaceholder}
          </option>
          {supportedCountries.map(c => (
            <option key={c} value={c}>
              {intl.formatMessage({ id: `PayoutDetailsForm.countryNames.${c}` })}
            </option>
          ))}
        </FieldSelect>

        <PayoutDetailsAddress country={country} intl={intl} disabled={disabled} form={form} />
      </div>
      {country ? (
        <div className={css.sectionContainer}>
          <h3 className={css.subTitle}>
            <FormattedMessage id="PayoutDetailsForm.bankDetails" />
          </h3>
          <StripeBankAccountTokenInputField
            disabled={disabled}
            name="bankAccountToken"
            formName="PayoutDetailsForm"
            country={country}
            currency={countryCurrency(country)}
            validate={bankAccountRequired}
          />
        </div>
      ) : null}

      {showPersonalIdNumber ? (
        <div className={css.sectionContainer}>
          <h3 className={css.subTitle}>
            <FormattedMessage id="PayoutDetailsForm.personalIdNumberTitle" />
          </h3>
          <FieldTextInput
            id="personalIdNumber"
            name="personalIdNumber"
            disabled={disabled}
            className={css.personalIdNumber}
            type="text"
            label={personalIdNumberLabel}
            placeholder={personalIdNumberPlaceholder}
            validate={personalIdNumberValid}
          />
        </div>
      ) : null}

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
