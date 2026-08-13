import React, { useRef, useEffect } from 'react';
import { ModelSelectorDropdown } from './ModelSelectorDropdown';
import * as api from '../services/api';

export interface DropdownLocation {
  ref: React.RefObject<HTMLDivElement | null>;
  config: any;
  onModelChanged?: (newModelId: string) => void;
}

interface DropdownManagerProps {
  locations: DropdownLocation[];
}

export const DropdownManager: React.FC<DropdownManagerProps> = ({ locations }) => {
  const dropdownRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});

  useEffect(() => {
    const u1 = api.listen<{ triggerId: number; state: 'open' | 'closed' }>('dropdown-toggle', (e) => {
      const { triggerId, state } = e.payload;
      if (dropdownRefs.current[triggerId]) {
        dropdownRefs.current[triggerId]?.classList.toggle('open', state === 'open');
      }
    });

    return () => {
      u1();
    };
  }, []);

  return (
    <div className="dropdown-manager z-[1000] pointer-events-none">
      {locations.map((loc, idx) => (
        <DropdownLocationWrapper
          key={idx}
          location={loc}
          dropdownRef={(el) => { dropdownRefs.current[idx] = el; }}
        />
      ))}
    </div>
  );
};

interface DropdownLocationWrapperProps {
  location: DropdownLocation;
  dropdownRef: (el: HTMLDivElement | null) => void;
}

const DropdownLocationWrapper: React.FC<DropdownLocationWrapperProps> = ({
  location,
  dropdownRef,
}) => {
  return (
    <div ref={location.ref} className="relative inline-block dropdown-trigger">
      <ModelSelectorDropdown config={location.config} onModelChanged={location.onModelChanged} />
      <div
        ref={dropdownRef}
        className="dropdown-container absolute z-50 pointer-events-auto opacity-0 invisible transition-opacity duration-200"
        style={{
          position: 'absolute',
          bottom: '100%',
          left: '0',
          right: '0',
          margin: '8px auto 0',
          transform: 'translateX(-50%)',
        }}
      >
        {/* Dropdown container */}
      </div>
    </div>
  );
};

export const createLocation = (
  ref: React.RefObject<HTMLDivElement | null>,
  config: any,
  onModelChanged?: (newModelId: string) => void
): DropdownLocation => ({ ref, config, onModelChanged });