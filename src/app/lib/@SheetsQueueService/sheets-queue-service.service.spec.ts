import { TestBed } from '@angular/core/testing';

import { SheetsQueueServiceService } from './sheets-queue-service.service';

describe('SheetsQueueServiceService', () => {
  let service: SheetsQueueServiceService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SheetsQueueServiceService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
