import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TestShceetComponent } from './test-shceet.component';

describe('TestShceetComponent', () => {
  let component: TestShceetComponent;
  let fixture: ComponentFixture<TestShceetComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestShceetComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TestShceetComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
