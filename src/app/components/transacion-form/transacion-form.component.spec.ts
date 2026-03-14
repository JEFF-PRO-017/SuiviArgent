import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TransacionFormComponent } from './transacion-form.component';

describe('TransacionFormComponent', () => {
  let component: TransacionFormComponent;
  let fixture: ComponentFixture<TransacionFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TransacionFormComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TransacionFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
