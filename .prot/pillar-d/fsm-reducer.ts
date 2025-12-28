/**
 * Pillar D: Explicit Finite State Machine Template
 *
 * Eliminate impossible states through discriminated unions.
 * Never use boolean flags for async state!
 *
 * ⚠️ AI DEVELOPMENT NOTE:
 * - COPY this pattern for each new stateful feature
 * - DO NOT use useState with boolean flags
 * - Each state variant has exactly the data it needs
 */

// ============================================
// 1. REQUEST STATE (Most Common Pattern)
// ============================================

/**
 * Generic request state for async operations
 *
 * Usage:
 * - API calls
 * - Data fetching
 * - Form submissions
 */
type RequestState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: string };

type RequestAction<T> =
  | { type: 'START' }
  | { type: 'SUCCESS'; data: T }
  | { type: 'ERROR'; error: string }
  | { type: 'RESET' };

function createRequestReducer<T>() {
  return function reducer(
    state: RequestState<T>,
    action: RequestAction<T>
  ): RequestState<T> {
    switch (action.type) {
      case 'START':
        return { status: 'loading' };
      case 'SUCCESS':
        return { status: 'success', data: action.data };
      case 'ERROR':
        return { status: 'error', error: action.error };
      case 'RESET':
        return { status: 'idle' };
      default:
        return state;
    }
  };
}

// ============================================
// 2. FORM STATE
// ============================================

/**
 * Form state with validation and submission
 *
 * Each state has exactly the fields it needs:
 * - editing: form data + validation errors
 * - submitting: form data (frozen)
 * - submitted: success message
 * - failed: form data + submission error
 */
interface FormData {
  email: string;
  password: string;
}

interface ValidationErrors {
  email?: string;
  password?: string;
}

type FormState =
  | { status: 'editing'; data: FormData; errors: ValidationErrors }
  | { status: 'submitting'; data: FormData }
  | { status: 'submitted'; message: string }
  | { status: 'failed'; data: FormData; error: string };

type FormAction =
  | { type: 'UPDATE_FIELD'; field: keyof FormData; value: string }
  | { type: 'VALIDATE' }
  | { type: 'SUBMIT' }
  | { type: 'SUBMIT_SUCCESS'; message: string }
  | { type: 'SUBMIT_ERROR'; error: string }
  | { type: 'RESET' };

function validateForm(data: FormData): ValidationErrors {
  const errors: ValidationErrors = {};
  if (!data.email.includes('@')) {
    errors.email = 'Invalid email';
  }
  if (data.password.length < 8) {
    errors.password = 'Password must be at least 8 characters';
  }
  return errors;
}

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case 'UPDATE_FIELD':
      if (state.status !== 'editing' && state.status !== 'failed') {
        return state;
      }
      const data = { ...state.data, [action.field]: action.value };
      return {
        status: 'editing',
        data,
        errors: validateForm(data),
      };

    case 'SUBMIT':
      if (state.status !== 'editing') return state;
      const errors = validateForm(state.data);
      if (Object.keys(errors).length > 0) {
        return { status: 'editing', data: state.data, errors };
      }
      return { status: 'submitting', data: state.data };

    case 'SUBMIT_SUCCESS':
      return { status: 'submitted', message: action.message };

    case 'SUBMIT_ERROR':
      if (state.status !== 'submitting') return state;
      return { status: 'failed', data: state.data, error: action.error };

    case 'RESET':
      return {
        status: 'editing',
        data: { email: '', password: '' },
        errors: {},
      };

    default:
      return state;
  }
}

// ============================================
// 3. WIZARD/MULTI-STEP STATE
// ============================================

/**
 * Multi-step flow with accumulated data
 *
 * Each step knows exactly what data is available:
 * - step 1: nothing yet
 * - step 2: has step 1 data
 * - step 3: has step 1 + 2 data
 */
interface StepOneData {
  name: string;
  email: string;
}

interface StepTwoData {
  address: string;
  city: string;
}

interface StepThreeData {
  cardNumber: string;
  expiry: string;
}

type WizardState =
  | { step: 'one'; data: Partial<StepOneData> }
  | { step: 'two'; stepOne: StepOneData; data: Partial<StepTwoData> }
  | { step: 'three'; stepOne: StepOneData; stepTwo: StepTwoData; data: Partial<StepThreeData> }
  | { step: 'submitting'; all: StepOneData & StepTwoData & StepThreeData }
  | { step: 'complete'; orderId: string }
  | { step: 'error'; error: string };

type WizardAction =
  | { type: 'UPDATE_STEP_ONE'; data: Partial<StepOneData> }
  | { type: 'COMPLETE_STEP_ONE'; data: StepOneData }
  | { type: 'UPDATE_STEP_TWO'; data: Partial<StepTwoData> }
  | { type: 'COMPLETE_STEP_TWO'; data: StepTwoData }
  | { type: 'UPDATE_STEP_THREE'; data: Partial<StepThreeData> }
  | { type: 'SUBMIT'; data: StepThreeData }
  | { type: 'SUCCESS'; orderId: string }
  | { type: 'ERROR'; error: string }
  | { type: 'BACK' };

function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case 'UPDATE_STEP_ONE':
      if (state.step !== 'one') return state;
      return { step: 'one', data: { ...state.data, ...action.data } };

    case 'COMPLETE_STEP_ONE':
      return { step: 'two', stepOne: action.data, data: {} };

    case 'UPDATE_STEP_TWO':
      if (state.step !== 'two') return state;
      return { ...state, data: { ...state.data, ...action.data } };

    case 'COMPLETE_STEP_TWO':
      if (state.step !== 'two') return state;
      return { step: 'three', stepOne: state.stepOne, stepTwo: action.data, data: {} };

    case 'SUBMIT':
      if (state.step !== 'three') return state;
      return {
        step: 'submitting',
        all: { ...state.stepOne, ...state.stepTwo, ...action.data },
      };

    case 'SUCCESS':
      return { step: 'complete', orderId: action.orderId };

    case 'ERROR':
      return { step: 'error', error: action.error };

    case 'BACK':
      if (state.step === 'two') {
        return { step: 'one', data: state.stepOne };
      }
      if (state.step === 'three') {
        return { step: 'two', stepOne: state.stepOne, data: state.stepTwo };
      }
      return state;

    default:
      return state;
  }
}

// ============================================
// 4. TEMPLATE FOR NEW FSM
// ============================================

/**
 * Copy this template for new state machines:
 *
 * 1. Define state union type with status/step discriminator
 * 2. Define action union type
 * 3. Create reducer with exhaustive switch
 * 4. Export types and reducer
 *
 * ```typescript
 * // 1. State - each variant has exactly needed data
 * type MyState =
 *   | { status: 'idle' }
 *   | { status: 'active'; data: MyData }
 *   | { status: 'complete'; result: MyResult }
 *   | { status: 'error'; error: string };
 *
 * // 2. Actions
 * type MyAction =
 *   | { type: 'START'; data: MyData }
 *   | { type: 'COMPLETE'; result: MyResult }
 *   | { type: 'ERROR'; error: string }
 *   | { type: 'RESET' };
 *
 * // 3. Reducer
 * function myReducer(state: MyState, action: MyAction): MyState {
 *   switch (action.type) {
 *     case 'START':
 *       return { status: 'active', data: action.data };
 *     case 'COMPLETE':
 *       return { status: 'complete', result: action.result };
 *     case 'ERROR':
 *       return { status: 'error', error: action.error };
 *     case 'RESET':
 *       return { status: 'idle' };
 *     default:
 *       return state;
 *   }
 * }
 * ```
 */

// ============================================
// USAGE EXAMPLES
// ============================================

/*
// ✅ CORRECT: Discriminated union

type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: Data }
  | { status: 'error'; error: string };

// In component:
switch (state.status) {
  case 'idle':
    return <Button onClick={load}>Load</Button>;
  case 'loading':
    return <Spinner />;
  case 'success':
    return <DataView data={state.data} />;  // data guaranteed!
  case 'error':
    return <Error message={state.error} />; // error guaranteed!
}


// ❌ WRONG: Boolean flags

const [isLoading, setIsLoading] = useState(false);
const [isError, setIsError] = useState(false);
const [data, setData] = useState<Data | null>(null);
const [error, setError] = useState<string | null>(null);

// Problems:
// 1. Can isLoading AND isError both be true? Undefined behavior!
// 2. When is data null? When error? Confusing!
// 3. Easy to forget resetting flags


// ❌ WRONG: Loose string status

const [status, setStatus] = useState('idle');
if (status === 'laoding') { }  // Typo compiles! No type safety


// ❌ WRONG: Optional fields everywhere

interface State {
  data?: Data;
  error?: Error;
  loading: boolean;
}
// When is data defined? When is error? No guarantees!
*/

export {
  createRequestReducer,
  formReducer,
  wizardReducer,
  validateForm,
};

export type {
  RequestState,
  RequestAction,
  FormState,
  FormAction,
  FormData,
  ValidationErrors,
  WizardState,
  WizardAction,
};
