import './ChoiceGroup.css';

/**
 * A row of big radio "chips" (native inputs, so keyboard and screen readers just work).
 *
 * @param {object} props
 * @param {string} props.legend
 * @param {string} props.name unique radio-group name
 * @param {Array<{ value: string|number, label: string }>} props.options
 * @param {string|number} props.value
 * @param {(value: string|number) => void} props.onChange
 */
export function ChoiceGroup({ legend, name, options, value, onChange }) {
  return (
    <fieldset className="choice">
      <legend className="choice__legend label">{legend}</legend>
      <div className="choice__options">
        {options.map((option) => (
          <label className="choice__option" key={option.value}>
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={option.value === value}
              onChange={() => onChange(option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export default ChoiceGroup;
