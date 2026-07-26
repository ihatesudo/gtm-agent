import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Dropdown, type DropdownOption } from '../components/Dropdown';

const options: DropdownOption[] = [
  { value: 'nemotron', label: 'Nemotron Ultra', detail: { tag: 'free', description: '1M ctx · tools ✓ · 稳定首选' } },
  { value: 'gemma', label: 'Gemma 4 31B', detail: { tag: 'free', description: '256k ctx · 开源旗舰' } },
  { value: 'glm', label: 'GLM-5.2', detail: { tag: 'paid', description: '智谱 · 国产' } },
];

const renderDropdown = (props = {}) =>
  render(
    <Dropdown
      value="nemotron"
      options={options}
      onChange={() => {}}
      ariaLabel="Model"
      {...props}
    />,
  );

describe('Dropdown', () => {
  it('renders a trigger button showing the selected label', () => {
    renderDropdown();
    expect(screen.getByRole('button', { name: /model/i })).toHaveTextContent('Nemotron Ultra');
  });

  it('does not show option details before opening', () => {
    renderDropdown();
    expect(screen.queryByText('1M ctx · tools ✓ · 稳定首选')).not.toBeInTheDocument();
  });

  it('opens the list on click and shows all option labels', async () => {
    renderDropdown();
    await userEvent.setup().click(screen.getByRole('button', { name: /model/i }));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Nemotron Ultra/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Gemma 4 31B/i })).toBeInTheDocument();
  });

  it('shows the selected option\'s detail card on hover (rich detail, not raw text)', async () => {
    const user = userEvent.setup();
    renderDropdown();
    await user.click(screen.getByRole('button', { name: /model/i }));
    // Hover the first option → its description appears in a detail card.
    await user.hover(screen.getByRole('option', { name: /Nemotron Ultra/i }));
    expect(screen.getByText('1M ctx · tools ✓ · 稳定首选')).toBeInTheDocument();
  });

  it('updates the detail card when hovering a different option', async () => {
    const user = userEvent.setup();
    renderDropdown();
    await user.click(screen.getByRole('button', { name: /model/i }));
    await user.hover(screen.getByRole('option', { name: /Gemma 4 31B/i }));
    expect(screen.getByText('256k ctx · 开源旗舰')).toBeInTheDocument();
  });

  it('calls onChange and closes when an option is clicked', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderDropdown({ onChange });
    await user.click(screen.getByRole('button', { name: /model/i }));
    await user.click(screen.getByRole('option', { name: /Gemma 4 31B/i }));
    expect(onChange).toHaveBeenCalledWith('gemma');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('supports keyboard: Enter opens, ArrowDown moves active option', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderDropdown({ onChange });
    const trigger = screen.getByRole('button', { name: /model/i });
    trigger.focus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    // First option is active (selected). Arrow once → second option active.
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledWith('gemma');
  });

  it('closes on Escape without changing the value', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderDropdown({ onChange });
    const trigger = screen.getByRole('button', { name: /model/i });
    trigger.focus();
    await user.keyboard('{Enter}');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('is disabled and non-interactive when the disabled prop is set', () => {
    renderDropdown({ disabled: true });
    const trigger = screen.getByRole('button', { name: /model/i });
    expect(trigger).toBeDisabled();
  });
});
